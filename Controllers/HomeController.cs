using JIRA_NTB.Data;
using JIRA_NTB.Models;
using JIRA_NTB.Models.Enums;
using JIRA_NTB.ViewModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using System;
using System.Data;
using System.Data.Common;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Net.NetworkInformation;
using System.Text;

namespace JIRA_NTB.Controllers
{
    public class HomeController : Controller
    {
        private readonly ILogger<HomeController> _logger;

        private readonly AppDbContext _context;
        private readonly UserManager<UserModel> _userManager;

        public HomeController(ILogger<HomeController> logger, AppDbContext context, UserManager<UserModel> userManager)
        {
            _logger = logger;
            _context = context;
            _userManager = userManager;
        }

        public IActionResult Index()
        {
            var isRole = "";
            if (User.IsInRole("ADMIN"))
            {
                isRole = "ADMIN";
            }
            else if (User.IsInRole("LEADER"))
            {
                isRole = "LEADER";
            }
            else
            {
                isRole = "EMPLOYEE";
            }
            ViewBag.Role = isRole;
            return View();
        }

        public async Task<IActionResult> Track()
        {
            //var isRole = "";
            //if (User.IsInRole("ADMIN"))
            //{
            //    isRole = "ADMIN";
            //}
            //else if (User.IsInRole("LEADER"))
            //{
            //    isRole = "LEADER";
            //}
            //else
            //{
            //    isRole = "EMPLOYEE";
            //}
            //ViewBag.Role = isRole;
            var user = await _userManager.GetUserAsync(User);
            var isRole = "";
            var deptId = "";

            if (user != null)
            {
                deptId = user.IdDepartment ?? ""; // Lấy ID phòng ban
                if (await _userManager.IsInRoleAsync(user, "ADMIN")) isRole = "ADMIN";
                else if (await _userManager.IsInRoleAsync(user, "LEADER")) isRole = "LEADER";
                else isRole = "EMPLOYEE";
            }

            ViewBag.Role = isRole;
            ViewBag.DeptId = deptId;
            return View();
        }

        #region GET: api/user/me -> Lấy người dùng hiện tại
        [HttpGet("api/user/me")]
        public async Task<IActionResult> GetCurrentUser()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null)
            {
                return Unauthorized();
            }

            UserModel leader = null;

            // Chỉ tìm Leader nếu người dùng hiện tại là EMPLOYEE và có phòng ban
            if (User.IsInRole("EMPLOYEE") && !string.IsNullOrEmpty(user.IdDepartment))
            {
                // 1. Tìm ID của vai trò (Role) "LEADER"
                // (Giả sử tên Role của bạn là "LEADER", 
                // dựa theo code `User.IsInRole("LEADER")` bạn gửi trước đó)
                var leaderRole = await _context.Roles
              .FirstOrDefaultAsync(r => r.Name == "LEADER");

                if (leaderRole != null)
                {
                    // 2. Tìm người dùng (User)
                    //    - Cùng phòng ban VỚI BẠN (user.IdDepartment)
                    //    - VÀ có RoleId là "LEADER"
                    leader = await (from u in _context.Users
                                    join ur in _context.UserRoles on u.Id equals ur.UserId
                                    where u.IdDepartment == user.IdDepartment && ur.RoleId == leaderRole.Id
                                    select u)
                      .FirstOrDefaultAsync();
                }
            }
            // Nếu bạn là LEADER hoặc ADMIN, 'leader' sẽ là null (vì bạn không có Leader)
            // Nếu bạn là EMPLOYEE mà phòng ban chưa có ai là LEADER, 'leader' cũng là null

            return Ok(new
            {
                user.FullName,
                user.Id,
                LeaderId = leader?.Id,
                LeaderName = leader?.FullName
            });
        }
        #endregion

        #region GET: api/tasks/statistics (SQL VERSION)
        [HttpGet("api/tasks/statistics")]
        public async Task<IActionResult> GetTasksStatistics()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            // 1. Viết câu lệnh SQL dùng "Conditional Aggregation"
            // Câu lệnh này đếm tất cả các trạng thái chỉ trong 1 lần quét bảng
            var sql = @"
                SELECT 
                    COUNT(t.IdTask) as TotalTasks,
                    COALESCE(SUM(CASE WHEN s.StatusName = 3 THEN 1 ELSE 0 END), 0) as CompletedTasks,
                    COALESCE(SUM(CASE WHEN s.StatusName = 2 AND t.Overdue = 0 THEN 1 ELSE 0 END), 0) as InProgressTasks,
                    COALESCE(SUM(CASE WHEN s.StatusName = 1 AND t.Overdue = 0 THEN 1 ELSE 0 END), 0) as TodoTasks,
                    COALESCE(SUM(CASE WHEN t.Overdue = 1 AND s.StatusName != 3 AND s.StatusName != 4 THEN 1 ELSE 0 END), 0) as OverdueTasks
                FROM Tasks t
                -- Join bảng Status để lấy StatusName (nếu bảng Task lưu StatusId)
                JOIN Statuses s ON t.StatusId = s.StatusId 
                -- Join bảng Project để phục vụ lọc Leader
                LEFT JOIN Projects p ON t.ProjectId = p.IdProject
                WHERE 1=1
            ";

            // 2. Thêm tham số lọc (Parameters)
            var parameters = new List<DbParameter>();

            if (User.IsInRole("LEADER"))
            {
                // Leader: Chỉ lấy task thuộc Project do mình tạo
                sql += " AND p.UserId = @UserId";
                parameters.Add(CreateParam("@UserId", user.Id));
            }
            else if (User.IsInRole("EMPLOYEE"))
            {
                // Employee: Chỉ lấy task được gán cho mình
                sql += " AND t.Assignee_Id = @UserId";
                parameters.Add(CreateParam("@UserId", user.Id));
            }

            // 3. Thực thi SQL
            var result = await RunRawSqlAsync(sql, parameters);
            return Ok(result);
        }
        #endregion

        #region GET: api/projects/statistics (SQL VERSION)
        [HttpGet("api/projects/statistics")]
        public async Task<IActionResult> GetProjectsStatistics()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            // Employee không xem thống kê dự án
            if (User.IsInRole("EMPLOYEE"))
                return Ok(new { Completed = 0, InProgress = 0, Todo = 0, Overdue = 0 });

            var sql = @"
                SELECT 
                    COALESCE(SUM(CASE WHEN s.StatusName = 3 AND p.EndDay >= @Now THEN 1 ELSE 0 END), 0) as Completed,
                    COALESCE(SUM(CASE WHEN s.StatusName = 2 AND p.EndDay >= @Now THEN 1 ELSE 0 END), 0) as InProgress,
                    COALESCE(SUM(CASE WHEN s.StatusName = 1 AND p.EndDay >= @Now THEN 1 ELSE 0 END), 0) as Todo,
                    COALESCE(SUM(CASE WHEN s.StatusName != 3 AND p.EndDay < @Now THEN 1 ELSE 0 END), 0) as Overdue
                FROM Projects p
                JOIN Statuses s ON p.StatusId = s.StatusId
                -- Join bảng User để check phòng ban của người quản lý
                LEFT JOIN Users u ON p.UserId = u.Id 
                WHERE 1=1
            ";

            var parameters = new List<DbParameter>();
            parameters.Add(CreateParam("@Now", DateTime.Now));

            if (User.IsInRole("LEADER"))
            {
                if (string.IsNullOrEmpty(user.IdDepartment))
                    return Ok(new { Completed = 0, InProgress = 0, Todo = 0, Overdue = 0 });

                // Lọc project mà người tạo (Manager) thuộc cùng phòng ban
                sql += " AND u.IdDepartment = @DeptId";
                parameters.Add(CreateParam("@DeptId", user.IdDepartment));
            }

            var result = await RunRawSqlAsync(sql, parameters);
            return Ok(result);
        }
        #endregion
        // =============================================================
        // HÀM HELPER (Copy hàm này vào cuối Controller)
        // =============================================================

        // Helper tạo tham số an toàn (chống SQL Injection)
        private DbParameter CreateParam(string name, object value)
        {
            var param = _context.Database.GetDbConnection().CreateCommand().CreateParameter();
            param.ParameterName = name;
            param.Value = value ?? DBNull.Value;
            return param;
        }

        // Helper chạy SQL và trả về Object
        private async Task<object> RunRawSqlAsync(string sql, List<DbParameter> parameters)
        {
            var connection = _context.Database.GetDbConnection();

            // Đảm bảo đóng kết nối dù có lỗi
            try
            {
                if (connection.State != ConnectionState.Open) await connection.OpenAsync();

                using (var command = connection.CreateCommand())
                {
                    command.CommandText = sql;
                    if (parameters != null) command.Parameters.AddRange(parameters.ToArray());

                    using (var reader = await command.ExecuteReaderAsync())
                    {
                        if (await reader.ReadAsync())
                        {
                            var dict = new Dictionary<string, object>();
                            for (int i = 0; i < reader.FieldCount; i++)
                            {
                                dict.Add(reader.GetName(i), reader.GetValue(i));
                            }
                            return dict;
                        }
                    }
                }
            }
            finally
            {
                // Đóng kết nối để trả về pool
                if (connection.State == ConnectionState.Open) await connection.CloseAsync();
            }

            // Trả về object mặc định nếu không có dữ liệu
            return new { TotalTasks = 0, CompletedTasks = 0, InProgressTasks = 0, TodoTasks = 0, OverdueTasks = 0 };
        }

        #region GET: api/projects/deadline -> Lấy danh sách deadline project
        [HttpGet("api/projects/deadline")]
        public async Task<IActionResult> GetProjectsDeadline()
        {
            var user = await _userManager.GetUserAsync(User);
            if (User.IsInRole("LEADER"))
            {
                var deadlines = await _context.Projects
                    .Where(p => p.UserId == user.Id)
                    .Select(p => new
                    {
                        p.IdProject,
                        p.ProjectName,
                        p.EndDay,
                        p.Manager.FullName,
                        p.Status.StatusName,
                        p.Note,
                    })
                    .ToListAsync();
                return Ok(deadlines);
            }
            else if(User.IsInRole("ADMIN"))
            {
                var deadlines = await _context.Projects
                    .Select(p => new
                    {
                        p.IdProject,
                        p.ProjectName,
                        p.EndDay,
                        p.Manager.FullName,
                        p.Status.StatusName,
                        p.Note,
                    }).ToListAsync();
                return Ok(deadlines);
            }
            return Ok();
        }
        #endregion

        #region GET: api/tasks/deadline  -> Lấy danh sách deadline task
        [HttpGet("api/tasks/deadline")]
        public async Task<IActionResult> GetTasksDeadline()
        {
            var user = await _userManager.GetUserAsync(User);
            if (User.IsInRole("EMPLOYEE"))
            {
                var deadlines = await _context.Tasks
                    .Where(d => d.Assignee_Id == user.Id)
                    .Select(t => new
                    {
                        t.IdTask,
                        t.NameTask,
                        t.Assignee.FullName,
                        t.EndDate,
                        t.Status.StatusName,
                        t.Project.ProjectName,
                        t.Note,
                    })
                    .ToListAsync();

                return Ok(deadlines);
            }
            else if (User.IsInRole("LEADER"))
            {
                var deadlines = await _context.Tasks
                    .Where(t => t.Assignee.IdDepartment == user.IdDepartment)
                    .Select(t => new
                    {
                        t.IdTask,
                        t.NameTask,
                        t.Assignee.FullName,
                        t.EndDate,
                        t.Status.StatusName,
                        t.Project.ProjectName,
                        t.Note,
                    })
                    .ToListAsync();

                return Ok(deadlines);
            }
            else if (User.IsInRole("ADMIN"))
            {

                return Ok(null);
            }
            return Ok();
        }
        #endregion

        #region GET: api/projects -> Lấy danh sách project theo role với phân trang
        [HttpGet("api/projects")]
        public async Task<IActionResult> GetProjects([FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 5, [FromQuery] string? departmentId = null)
        {
            var user = await _userManager.GetUserAsync(User);
            var now = DateTime.Now;

            // 🔹 Bắt đầu từ tất cả project
            IQueryable<ProjectModel> query = _context.Projects;

            // 🔹 Lọc theo role
            if (User.IsInRole("LEADER"))
            {
                query = query.Where(p => p.UserId == user.Id);
            }
            else if (User.IsInRole("EMPLOYEE"))
            {
                var projectIds = await _context.ProjectManagers
                    .Where(pm => pm.UserId == user.Id)
                    .Select(pm => pm.ProjectId)
                    .ToListAsync();

                query = query.Where(p => projectIds.Contains(p.IdProject));
            }

            if (User.IsInRole("ADMIN") && !string.IsNullOrEmpty(departmentId) && departmentId != "all")
            {
                // Giả sử Project có Manager, và Manager thuộc Department
                // Hoặc Project có trực tiếp DepartmentId. Tùy DB của bạn.
                // Ví dụ: Lọc các dự án do Manager thuộc phòng ban đó quản lý
                query = query.Where(p => p.Manager.IdDepartment == departmentId);
            }

            // THÊM: Đếm tổng
            var totalCount = await query.CountAsync();

            // SỬA: Thêm dòng tính totalPages
            var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);
            if (totalPages == 0) totalPages = 1; // Đảm bảo luôn có ít nhất 1 trang

            // 🔹 Truy vấn dữ liệu chung
            var projects = await query
                .OrderByDescending(p => p.CreateAt)
                //.OrderByDescending(p => p.EndDay)
                .Skip((pageIndex - 1) * pageSize)
                .Take(pageSize)
                .Select(p => new
                {
                    p.IdProject,
                    p.ProjectName,
                    p.StartDay,
                    p.EndDay,
                    Status = p.Status.StatusName,
                    FileNote = p.FileNote,
                    Note = p.Note,
                    Manager = p.Manager.FullName,
                })
                .ToListAsync();

            return Ok(new {
                TotalCount = totalCount,
                PageSize = pageSize,
                PageIndex = pageIndex,
                TotalPages = totalPages,
                Items = projects
            });
        }
        #endregion

        #region GET: api/projects/:idProject/members -> Lấy thành viên theo project
        [HttpGet("api/projects/{idProject}/members")]
        public async Task<IActionResult> GetMembersByProject(string idProject)
        {
            var members = await _context.ProjectManagers
                .Where(m => m.ProjectId == idProject)
                .Select(m => new
                {
                    m.ProjectId,
                    Id = m.User.Id,
                    Fullname = m.User.FullName
                })
                .ToListAsync();
            return Ok(members);
        }
        #endregion

        #region GET: api/projects/:idProject/name -> Lấy tên project theo ID
        [HttpGet("api/projects/{idProject}/name")]
        public async Task<IActionResult> GetProjectNameById(string idProject)
        {
            var project = await _context.Projects
                .Where(p => p.IdProject == idProject)
                .Select(p => new
                {
                    p.ProjectName
                })
                .FirstOrDefaultAsync();
            if (project == null)
            {
                return NotFound(new { message = "Không tìm thấy project." });
            }
            return Ok(project);
        }
        #endregion

        #region GET: api/tasks -> Lấy danh sách task theo role có phân trang
        [HttpGet("api/tasks")]
        public async Task<IActionResult> GetTasks()
        {
            var user = await _userManager.GetUserAsync(User);

            IQueryable<TaskItemModel> query = _context.Tasks
                .Include(t => t.Project)
                .Include(t => t.Status)
                .Include(t => t.Assignee);

            // ⚙️ Lọc theo role
            if (User.IsInRole("ADMIN"))
            {
                // ADMIN → thấy tất cả task (không cần lọc)
            }
            else if (User.IsInRole("LEADER"))
            {
                // LEADER → chỉ thấy task thuộc dự án mình làm leader
                var projectIds = await _context.Projects
                    .Where(p => p.UserId == user.Id)
                    .Select(p => p.IdProject)
                    .ToListAsync();

                query = query.Where(t => projectIds.Contains(t.ProjectId));
            }
            else
            {
                // USER → chỉ thấy task thuộc dự án mình tham gia & được giao
                var projectIds = await _context.ProjectManagers
                    .Where(pm => pm.UserId == user.Id)
                    .Select(pm => pm.ProjectId)
                    .ToListAsync();

                query = query.Where(t => projectIds.Contains(t.ProjectId) && t.Assignee_Id == user.Id);
            }

            var tasks = await query
                .Select(t => new
                {
                    t.IdTask,
                    t.NameTask,
                    t.Priority,
                    t.Overdue,
                    t.FileNote,
                    t.Note,
                    t.StartDate,
                    t.EndDate,
                    t.Assignee_Id,
                    t.ProjectId,
                    ProjectName = t.Project.ProjectName,
                    StatusName = t.Status.StatusName,
                    NameAssignee = t.Assignee.FullName
                })
                .ToListAsync();

            return Ok(tasks);
        }
        #endregion

        #region GET: api/projects/{projectId}/tasks?pageIndex=1&pageSize=10 -> Lấy danh sách task theo project với phân trang
        [HttpGet("api/projects/{projectId}/tasks")]
        public async Task<IActionResult> GetTasksForProject(string projectId, [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 10)
        {
            var user = await _userManager.GetUserAsync(User);

            // --- 1. Kiểm tra bảo mật: User này có quyền xem project này không? ---
            bool canViewProject = false;
            if (User.IsInRole("ADMIN"))
            {
                canViewProject = true; // Admin thấy tất cả
            }
            else if (User.IsInRole("LEADER"))
            {
                // Leader phải sở hữu project
                canViewProject = await _context.Projects
                    .AnyAsync(p => p.IdProject == projectId && p.UserId == user.Id);
            }
            else // "EMPLOYEE"
            {
                // Employee phải được gán vào project
                canViewProject = await _context.ProjectManagers
                    .AnyAsync(pm => pm.ProjectId == projectId && pm.UserId == user.Id);
            }

            if (!canViewProject)
            {
                return Forbid(); // 403 - Không có quyền
            }

            // --- 2. Xây dựng Query (chỉ cho project này) ---
            IQueryable<TaskItemModel> query = _context.Tasks
                .Where(t => t.ProjectId == projectId); // <-- Lọc theo ProjectID
                                                       // Không cần Include() Project ở đây nữa vì đã lọc

            // --- 3. Lọc task cho EMPLOYEE (nếu cần) ---
            if (User.IsInRole("EMPLOYEE"))
            {
                // Employee chỉ thấy task được gán cho mình
                query = query.Where(t => t.Assignee_Id == user.Id);
            }

            // --- 4. Lấy tổng số (trước khi phân trang) ---
            var totalTasks = await query.CountAsync();
            var totalPages = (int)Math.Ceiling((double)totalTasks / pageSize);

            // --- 5. Lấy dữ liệu đã phân trang ---
            var tasks = await query
                .OrderByDescending(t => t.CreateAt) // Sort theo ngày tạo, mới nhất lên đầu                                                    // Sắp xếp (ví dụ: ưu tiên cao lên đầu)
                .Skip((pageIndex - 1) * pageSize)
                .Take(pageSize)
                .Include(t => t.Status)     // Include Status và Assignee
                .Include(t => t.Assignee)
                .Select(t => new
                {
                    t.IdTask,
                    t.NameTask,
                    t.Priority,
                    t.Overdue,
                    t.FileNote,
                    t.Note,
                    t.StartDate,
                    t.EndDate,
                    t.Assignee_Id,
                    t.ProjectId,
                    t.CreateAt,
                    // ProjectName không cần nữa vì chúng ta đã ở trong project đó
                    StatusName = t.Status.StatusName,
                    NameAssignee = t.Assignee.FullName
                })
                .ToListAsync();

            // --- 6. Trả về đối tượng phân trang ---
            return Ok(new
            {
                items = tasks,
                pageIndex = pageIndex,
                totalPages = totalPages,
                totalCount = totalTasks
            });
        }
        #endregion

        // [GET] api/tasks/all?pageIndex=1&pageSize=50
        [HttpGet("api/tasks/all")]
        public async Task<IActionResult> GetAllTasks(
        [FromQuery] int pageIndex = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? departmentId = null)
        {
            // 1. Lấy ID và Department của User hiện tại
            var userId = _userManager.GetUserId(User);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            // Query nhẹ để lấy DepartmentId của user hiện tại (cần thiết cho logic Leader)
            // Dùng Select để chỉ lấy 1 cột thay vì lôi cả object User nặng nề
            var userDepartmentId = await _context.Users
                .Where(u => u.Id == userId)
                .Select(u => u.IdDepartment)
                .FirstOrDefaultAsync();

            // 2. Sử dụng AsNoTracking() - QUAN TRỌNG
            IQueryable<TaskItemModel> query = _context.Tasks.AsNoTracking();

            var cutoffDate = DateTime.Now.AddDays(-2);

            query = query.Where(t => 
                t.Status.StatusName != TaskStatusModel.Done
                &&
                t.Status.StatusName != TaskStatusModel.Deleted
                &&
                (t.EndDate == null || t.EndDate >= cutoffDate)
            );

            // 3. Phân quyền dữ liệu
            if (User.IsInRole("ADMIN"))
            {
                // ADMIN: Thấy hết
                // Nếu Admin truyền tham số departmentId vào thì lọc theo ý Admin
                if (!string.IsNullOrEmpty(departmentId) && departmentId != "all")
                {
                    query = query.Where(t => t.Assignee.IdDepartment == departmentId);
                }
            }
            else if (User.IsInRole("LEADER"))
            {
                // LEADER: Chỉ thấy task của các thành viên (bao gồm chính mình) TRONG CÙNG PHÒNG BAN
                // Logic: Join bảng Assignee và check IdDepartment
                if (!string.IsNullOrEmpty(userDepartmentId))
                {
                    query = query.Where(t => t.Assignee.IdDepartment == userDepartmentId);
                }
                else
                {
                    // Trường hợp Leader nhưng chưa được gán phòng ban -> Chỉ thấy của chính mình (Fallback)
                    query = query.Where(t => t.Assignee_Id == userId);
                }
            }
            else // EMPLOYEE
            {
                // EMPLOYEE: Chỉ thấy task được gán cho chính mình
                query = query.Where(t => t.Assignee_Id == userId);
            }

            // 4. Đếm tổng số (Tối ưu performance)
            var totalTasks = await query.CountAsync();

            // Nếu pageIndex vượt quá số trang thực tế, trả về rỗng ngay
            if (totalTasks == 0 || (pageIndex - 1) * pageSize >= totalTasks)
            {
                return Ok(new { items = new List<object>(), pageIndex, pageSize, totalPages = 0, totalCount = 0 });
            }

            var totalPages = (int)Math.Ceiling((double)totalTasks / pageSize);

            // 5. Query dữ liệu
            var tasks = await query
                .OrderBy(t => t.StartDate) // Đảm bảo cột StartDate có Index
                .Skip((pageIndex - 1) * pageSize)
                .Take(pageSize)
                .Select(t => new
                {
                    t.IdTask,
                    t.NameTask,
                    t.Priority,
                    t.Overdue,
                    t.StartDate,
                    t.EndDate,
                    t.Assignee_Id,
                    t.ProjectId,

                    // Projection (Chọn lọc cột cần thiết)
                    ProjectName = t.Project.ProjectName,
                    StatusName = t.Status.StatusName,
                    // StatusId = t.Status.StatusId,
                    NameAssignee = t.Assignee.FullName
                })
                .ToListAsync();

            return Ok(new
            {
                items = tasks,
                pageIndex,
                pageSize,
                totalPages,
                totalCount = totalTasks
            });
        }

        [HttpGet("api/tasks/gantt-by-user")]
        public async Task<IActionResult> GetGanttTasksByUser(
    [FromQuery] int userPageIndex = 1,
    [FromQuery] int userPageSize = 5,
    [FromQuery] string? departmentId = null)
        {
            var currentUser = await _userManager.GetUserAsync(User);
            if (currentUser == null) return Unauthorized();

            // =========================================================
            // BƯỚC 1: LỌC USER (Giữ nguyên logic cũ - rất tốt)
            // =========================================================
            IQueryable<UserModel> userQuery = _context.Users.AsQueryable();

            if (User.IsInRole("LEADER"))
            {
                if (!string.IsNullOrEmpty(currentUser.IdDepartment))
                    userQuery = userQuery.Where(u => u.IdDepartment == currentUser.IdDepartment);
            }
            else if (User.IsInRole("EMPLOYEE"))
            {
                userQuery = userQuery.Where(u => u.Id == currentUser.Id);
            }
            else
            {
                if (!string.IsNullOrEmpty(departmentId) && departmentId != "all")
                    userQuery = userQuery.Where(u => u.IdDepartment == departmentId);
            }

            var totalUsers = await userQuery.CountAsync();

            // Chỉ lấy ID và Tên để nhẹ dữ liệu
            var pagedUsers = await userQuery
                .OrderBy(u => u.FullName)
                .Skip((userPageIndex - 1) * userPageSize)
                .Take(userPageSize)
                .Select(u => new { u.Id, u.FullName })
                .ToListAsync();

            if (!pagedUsers.Any())
            {
                return Ok(new { items = new List<object>(), totalUsers, pageIndex = userPageIndex });
            }

            // =========================================================
            // BƯỚC 2: TỐI ƯU HÓA FETCH TASK (Database-side Limit)
            // =========================================================

            // List chứa kết quả cuối cùng
            var finalTasks = new List<object>();

            // Chạy vòng lặp cho 5 user (số lượng nhỏ nên không ảnh hưởng hiệu năng)
            foreach (var user in pagedUsers)
            {
                // Query này sẽ được dịch sang SQL có LIMIT/TOP 10 ngay tại DB
                // Indexing: Cần đánh Index cho cột [Assignee_Id] và [Status/StartDate] trong DB
                var topTasks = await _context.Tasks
                    .AsNoTracking() // Tăng tốc độ đọc (không cần theo dõi thay đổi)
                    .Where(t => t.Assignee_Id == user.Id)
                    // Sắp xếp ưu tiên ngay trong SQL
                    .OrderBy(t => t.Status.StatusName == TaskStatusModel.InProgress ? 1 : (t.Status.StatusName == TaskStatusModel.Todo ? 2 : 3))
                    .ThenBy(t => t.StartDate)
                    .Take(10) // CHỈ LẤY ĐÚNG 10 TASK
                    .Select(t => new
                    {
                        t.IdTask,
                        t.NameTask,
                        t.StartDate,
                        t.EndDate,
                        t.Assignee_Id,
                        t.ProjectId,
                        t.Priority,
                        t.Overdue,
                        ProjectName = t.Project.ProjectName,
                        StatusName = t.Status.StatusName,
                        NameAssignee = user.FullName, // Lấy tên từ vòng lặp, khỏi cần Join bảng User
                        SortPriority = t.Status.StatusName == TaskStatusModel.InProgress ? 1 : (t.Status.StatusName == TaskStatusModel.Todo ? 2 : 3)
                    })
                    .ToListAsync();

                finalTasks.AddRange(topTasks);
            }

            return Ok(new
            {
                items = finalTasks,
                totalUsers = totalUsers,
                pageIndex = userPageIndex,
                pageSize = userPageSize
            });
        }

        #region GET: api/projects/{projectId}/all-tasks -> Lấy tất cả task theo project (không phân trang)
        [HttpGet("api/projects/{projectId}/all-tasks")]
        public async Task<IActionResult> GetAllTasksForProject(string projectId)
        {
            var user = await _userManager.GetUserAsync(User);

            // --- 1. Kiểm tra bảo mật (Giữ nguyên) ---
            bool canViewProject = false;
            if (User.IsInRole("ADMIN"))
            {
                canViewProject = true;
            }
            else if (User.IsInRole("LEADER"))
            {
                canViewProject = await _context.Projects
                    .AnyAsync(p => p.IdProject == projectId && p.UserId == user.Id);
            }
            else
            { // "EMPLOYEE"
                canViewProject = await _context.ProjectManagers
                    .AnyAsync(pm => pm.ProjectId == projectId && pm.UserId == user.Id);
            }

            if (!canViewProject)
            {
                return Forbid(); // 403 - Không có quyền
            }

            // --- 2. Xây dựng Query (chỉ cho project này) ---
            IQueryable<TaskItemModel> query = _context.Tasks
                .Where(t => t.ProjectId == projectId);

            if (User.IsInRole("EMPLOYEE"))
            {
                query = query.Where(t => t.Assignee_Id == user.Id);
            }

            // --- 3. Lấy TẤT CẢ task (Không phân trang) ---
            var tasks = await query
                .OrderBy(t => t.StartDate) // Sắp xếp theo ngày bắt đầu
                .Include(t => t.Status)
                .Include(t => t.Assignee)
                .Select(t => new
                {
                    t.IdTask,
                    t.NameTask,
                    t.Priority,
                    t.Overdue,
                    // Bổ sung StatusId/Name để tính %
                    StatusId = t.Status.StatusName, // (Giả sử IdStatus là 1, 2, 3)
                    t.FileNote,
                    t.Note,
                    t.StartDate,
                    t.EndDate,
                    t.Assignee_Id,
                    t.ProjectId,
                    StatusName = t.Status.StatusName,
                    NameAssignee = t.Assignee.FullName
                })
                .ToListAsync();

            // --- 4. Trả về một mảng task ---
            return Ok(tasks);
        }
        #endregion

        #region GET: api/projects/list -> Lấy danh sách project cho dropdown
        [HttpGet("api/projects/list")]
        public async Task<IActionResult> GetProjectList()
        {
            var user = await _userManager.GetUserAsync(User);
            IQueryable<ProjectModel> query = _context.Projects;

            // ⚙️ Lọc theo role
            if (User.IsInRole("ADMIN"))
            {
                // Admin thấy tất cả
            }
            else if (User.IsInRole("LEADER"))
            {
                // Leader thấy project mình tạo
                query = query.Where(p => p.UserId == user.Id);
            }
            else // "EMPLOYEE"
            {
                // Employee thấy project mình được gán
                var projectIds = await _context.ProjectManagers
                    .Where(pm => pm.UserId == user.Id)
                    .Select(pm => pm.ProjectId)
                    .ToListAsync();

                query = query.Where(p => projectIds.Contains(p.IdProject));
            }

            var projectList = await query
                .Select(p => new {
                    p.IdProject,
                    p.ProjectName,
                    p.StartDay,
                    p.EndDay
                })
                .ToListAsync();

            return Ok(projectList);
        }
        #endregion

        #region GET: api/departments/list -> Lấy danh sách phòng ban cho dropdown
        [HttpGet("api/departments/list")]
        public async Task<IActionResult> GetDepartmentList()
        {
            var departments = await _context.Departments
                .Select(d => new
                {
                    d.IdDepartment,
                    d.DepartmentName
                })
                .ToListAsync();
            return Ok(departments);
        }
        #endregion

        #region GET: api/client/ip
        //[HttpGet("api/server/address")]
        //public IActionResult GetClientIp()
        //{
        //    var ipAddress = HttpContext.Connection.LocalIpAddress?.ToString();

        //    var mac = NetworkInterface.GetAllNetworkInterfaces()
        //        .Where(nic => nic.OperationalStatus == OperationalStatus.Up &&
        //                      nic.NetworkInterfaceType != NetworkInterfaceType.Loopback)
        //        .Select(nic => nic.GetPhysicalAddress().ToString())
        //        .FirstOrDefault();

        //    // Format MAC cho dễ đọc: "AA:BB:CC:DD:EE:FF"
        //    if (!string.IsNullOrEmpty(mac))
        //        mac = string.Join(":", Enumerable.Range(0, mac.Length / 2)
        //            .Select(i => mac.Substring(i * 2, 2)));

        //    var accessTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
        //    // --- Ghi log vào file ---
        //    var logLine = $"{accessTime} - IP: {ipAddress ?? "Không xác định"} - MAC: {mac ?? "Không xác định"}";
        //    var logPath = Path.Combine(AppContext.BaseDirectory, "access_log.txt");

        //    try
        //    {
        //        System.IO.File.AppendAllText(logPath, logLine + Environment.NewLine);
        //    }
        //    catch (Exception ex)
        //    {
        //        // Nếu muốn, có thể log lỗi ghi file ra console
        //        Console.WriteLine("❌ Lỗi ghi log: " + ex.Message);
        //    }

        //    return Ok(new
        //    {
        //        ip = ipAddress ?? "Không xác định",
        //        mac = mac ?? "Không xác định",
        //        accessTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
        //    });
        //}
        #endregion

        #region GET: api/client/mac
        //[HttpGet("api/client/address")]
        //public IActionResult GetClientMac()
        //{
        //    string clientIp = HttpContext.Connection.RemoteIpAddress?.ToString();
        //    if (string.IsNullOrEmpty(clientIp))
        //        return BadRequest("Không tìm thấy IP client");

        //    try
        //    {
        //        var process = new Process
        //        {
        //            StartInfo = new ProcessStartInfo
        //            {
        //                FileName = "arp",
        //                Arguments = "-a " + clientIp,
        //                RedirectStandardOutput = true,
        //                UseShellExecute = false,
        //                CreateNoWindow = true
        //            }
        //        };
        //        process.Start();
        //        string output = process.StandardOutput.ReadToEnd();
        //        process.WaitForExit();

        //        // Parse MAC (Windows format)
        //        var match = System.Text.RegularExpressions.Regex.Match(output, "([0-9A-Fa-f]{2}(-[0-9A-Fa-f]{2}){5})");
        //        string macAddress = match.Success ? match.Value.Replace('-', ':') : "Không xác định";

        //        var accessTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
        //        // --- Ghi log vào file ---
        //        var logLine = $"{accessTime} - IP: {clientIp ?? "Không xác định"} - MAC: {macAddress ?? "Không xác định"}";
        //        var logPath = Path.Combine(AppContext.BaseDirectory, "access_log.txt");

        //        try
        //        {
        //            System.IO.File.AppendAllText(logPath, logLine + Environment.NewLine);
        //        }
        //        catch (Exception ex)
        //        {
        //            // Nếu muốn, có thể log lỗi ghi file ra console
        //            Console.WriteLine("❌ Lỗi ghi log: " + ex.Message);
        //        }

        //        return Ok(new { 
        //            ip = clientIp,
        //            mac = macAddress,
        //            accessTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
        //        });
        //    }
        //    catch (Exception ex)
        //    {
        //        return BadRequest($"Lỗi: {ex.Message}");
        //    }
        //}
        #endregion

        #region GET: api/server/processes
        //[HttpGet("api/server/processes")]
        //public IActionResult LogRunningProcesses()
        //{
        //    try
        //    {
        //        var processes = Process.GetProcesses()
        //            .OrderBy(p => p.ProcessName)
        //            .Select(p => $"{p.ProcessName} (PID: {p.Id})")
        //            .ToList();

        //        var logPath = Path.Combine(AppContext.BaseDirectory, "process_log.txt");
        //        var logTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
        //        var logContent = new StringBuilder();
        //        logContent.AppendLine($"🕒 {logTime} - Danh sách tiến trình đang chạy:");
        //        logContent.AppendLine(string.Join(Environment.NewLine, processes));
        //        logContent.AppendLine(new string('-', 60));

        //        System.IO.File.AppendAllText(logPath, logContent.ToString());

        //        return Ok(new
        //        {
        //            message = "✅ Đã ghi log danh sách tiến trình đang chạy.",
        //            processCount = processes.Count
        //        });
        //    }
        //    catch (Exception ex)
        //    {
        //        return BadRequest(new { error = ex.Message });
        //    }
        //}
        #endregion

        #region POST: Home/SaveTask -> Cập nhật hoặc Thêm mới Task
        // ==================== API: Thêm hoặc Cập nhật Task ====================
        [HttpPost]
        public async Task<IActionResult> SaveTask([FromBody] TaskObjectViewModel model)
        {
            if (model == null)
            {
                return BadRequest(new { success = false, message = "Dữ liệu gửi lên không hợp lệ." });

            }

            try
            {
                // Kiểm tra xem có tồn tại task không
                var existingTask = await _context.Tasks.FirstOrDefaultAsync(t => t.IdTask == model.Id);

                if (existingTask != null)
                {
                    // --- Cập nhật ---
                    existingTask.Note = model.Desc;
                    existingTask.EndDate = DateTime.ParseExact(model.End, "yyyy-MM-dd", CultureInfo.InvariantCulture);
                    existingTask.FileNote = model.File;
                    existingTask.Assignee_Id = model.IdAss;
                    existingTask.ProjectId = model.IdPrj;
                    existingTask.NameTask = model.Name;
                    existingTask.Priority = model.Prior;
                    existingTask.StartDate = DateTime.ParseExact(model.Start, "yyyy-MM-dd", CultureInfo.InvariantCulture);
                    existingTask.StatusId = model.Status;

                    _context.Tasks.Update(existingTask);
                }
                else
                {
                    // --- Thêm mới ---
                    var newTask = new TaskItemModel
                    {
                        IdTask = model.Id,
                        Note = model.Desc,
                        EndDate = DateTime.ParseExact(model.End, "yyyy-MM-dd", CultureInfo.InvariantCulture),
                        FileNote = model.File,
                        Assignee_Id = model.IdAss ?? null,
                        ProjectId = model.IdPrj,
                        NameTask = model.Name,
                        Priority = model.Prior,
                        StartDate = DateTime.ParseExact(model.Start, "yyyy-MM-dd", CultureInfo.InvariantCulture),
                        StatusId = model.Status,
                    };
                    await _context.Tasks.AddAsync(newTask);
                }

                await _context.SaveChangesAsync();
                return Ok(new { success = true, message = "Lưu task thành công!" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }
        #endregion

        #region PATCH: api/task/:idTask/status/todo -> Cập nhật trạng thái task thành "Todo"
        [HttpPatch("api/task/{idTask}/status/todo")]
        public async Task<IActionResult> HandleTodoTask(string idTask)
        {
            var task = await _context.Tasks.FirstOrDefaultAsync(t => t.IdTask == idTask);
            if (task == null)
            {
                return NotFound(new { success = false, message = "Không tìm thấy task." });
            }
            var statusTodo = await _context.Statuses.FirstOrDefaultAsync(s => s.StatusName == TaskStatusModel.Todo);
            if (statusTodo == null)
            {
                return NotFound(new { success = false, message = "Trạng thái 'Todo' không tồn tại." });
            }
            task.StatusId = statusTodo.StatusId;
            await _context.SaveChangesAsync();
            return Ok(new { success = true, message = "Cập nhật trạng thái thành công." });
        }
        #endregion

        #region PATCH: api/task/:idTask/status/inprogress -> Cập nhật trạng thái task thành "In Progress"
        [HttpPatch("api/task/{idTask}/status/inprogress")]
        public async Task<IActionResult> HandleInProgressTask(string idTask)
        {
            var task = await _context.Tasks.FirstOrDefaultAsync(t => t.IdTask == idTask);
            if (task == null)
            {
                return NotFound(new { success = false, message = "Không tìm thấy task." });
            }
            var statusInProgress = await _context.Statuses.FirstOrDefaultAsync(s => s.StatusName == TaskStatusModel.InProgress);
            if (statusInProgress == null)
            {
                return NotFound(new { success = false, message = "Trạng thái 'In Progress' không tồn tại." });
            }
            task.StatusId = statusInProgress.StatusId;
            await _context.SaveChangesAsync();
            return Ok(new { success = true, message = "Cập nhật trạng thái thành công." });
        }
        #endregion

        #region PATCH: api/task/:idTask/status/done -> Cập nhật trạng thái task thành "Done"
        [HttpPatch("api/task/{idTask}/status/done")]
        public async Task<IActionResult> HandleDoneTask(string idTask)
        {
            var task = await _context.Tasks.FirstOrDefaultAsync(t => t.IdTask == idTask);
            if (task == null)
            {
                return NotFound(new { success = false, message = "Không tìm thấy task." });
            }
            var statusDone = await _context.Statuses.FirstOrDefaultAsync(s => s.StatusName == TaskStatusModel.Done);
            if (statusDone == null)
            {
                return NotFound(new { success = false, message = "Trạng thái 'Done' không tồn tại." });
            }
            task.StatusId = statusDone.StatusId;
            task.CompletedDate = DateTime.Now;
            await _context.SaveChangesAsync();
            return Ok(new { success = true, message = "Cập nhật trạng thái thành công." });
        }
        #endregion

        #region PATCH: api/project/:idProject/status/todo -> Cập nhật trạng thái project thành "Todo"
        [HttpPatch("api/project/{idProject}/status/todo")]
        public async Task<IActionResult> HandleTodoProject(string idProject)
        {
            var project = await _context.Projects.FirstOrDefaultAsync(p => p.IdProject == idProject);
            if (project == null)
            {
                return NotFound(new { success = false, message = "Không tìm thấy project." });
            }
            var statusTodo = await _context.Statuses.FirstOrDefaultAsync(s => s.StatusName == TaskStatusModel.Todo);
            if (statusTodo == null)
            {
                return NotFound(new { success = false, message = "Trạng thái 'Todo' không tồn tại." });
            }
            project.StatusId = statusTodo.StatusId;
            await _context.SaveChangesAsync();
            return Ok(new { success = true, message = "Cập nhật trạng thái thành công." });
        }
        #endregion

        #region PATCH: api/project/:idProject/status/inprogress -> Cập nhật trạng thái project thành "In Progress"
        [HttpPatch("api/project/{idProject}/status/inprogress")]
        public async Task<IActionResult> HandleInProgressProject(string idProject)
        {
            var project = await _context.Projects.FirstOrDefaultAsync(p => p.IdProject == idProject);
            if (project == null)
            {
                return NotFound(new { success = false, message = "Không tìm thấy project." });
            }
            var statusInProgress = await _context.Statuses.FirstOrDefaultAsync(s => s.StatusName == TaskStatusModel.InProgress);
            if (statusInProgress == null)
            {
                return NotFound(new { success = false, message = "Trạng thái 'In Progress' không tồn tại." });
            }
            project.StatusId = statusInProgress.StatusId;
            await _context.SaveChangesAsync();
            return Ok(new { success = true, message = "Cập nhật trạng thái thành công." });
        }
        #endregion

        #region PATCH: api/project/:idProject/status/done -> Cập nhật trạng thái project thành "Done"
        [HttpPatch("api/project/{idProject}/status/done")]
        public async Task<IActionResult> HandleDoneProject(string idProject)
        {
            var project = await _context.Projects.FirstOrDefaultAsync(p => p.IdProject == idProject);
            if (project == null)
            {
                return NotFound(new { success = false, message = "Không tìm thấy project." });
            }
            var statusDone = await _context.Statuses.FirstOrDefaultAsync(s => s.StatusName == TaskStatusModel.Done);
            if (statusDone == null)
            {
                return NotFound(new { success = false, message = "Trạng thái 'Done' không tồn tại." });
            }
            project.StatusId = statusDone.StatusId;
            await _context.SaveChangesAsync();
            return Ok(new { success = true, message = "Cập nhật trạng thái thành công." });
        }
        #endregion

        #region DELETE: Home/DeleteTask -> Xóa Task
        [HttpDelete]
        public async Task<IActionResult> DeleteTask(string id)
        {
            if (string.IsNullOrEmpty(id))
            {
                return BadRequest(new { success = false, message = "Thiếu ID task cần xóa." });
            }

            try
            {
                var task = await _context.Tasks.FirstOrDefaultAsync(t => t.IdTask == id);
                if (task == null)
                {
                    return NotFound(new { success = false, message = "Không tìm thấy task cần xóa." });
                }

                _context.Tasks.Remove(task);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "Xóa task thành công!" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = $"Lỗi khi xóa: {ex.Message}" });
            }
        }
        #endregion
    }
}
