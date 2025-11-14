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

        public async Task<IActionResult> Index()
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

        #region GET: api/user/me
        [HttpGet("api/user/me")]
        public async Task<IActionResult> GetCurrentUser()
        {
            var user = await _userManager.GetUserAsync(User);
            return Ok(new {
                user.FullName,
            });
        }
        #endregion

        #region GET: api/tasks/statistics
        [HttpGet("api/tasks/statistics")]
        public async Task<IActionResult> GetTasksStatistics()
        {
            var user = await _userManager.GetUserAsync(User);
            var now = DateTime.Now;

            // 1. Bắt đầu với IQueryable<TaskItemModel>
            IQueryable<TaskItemModel> taskQuery = _context.Tasks;

            // 2. Lọc task theo role (thay vì lọc project)
            // 🔹 Lọc theo role
            if (User.IsInRole("LEADER"))
            {
                // Lấy task thuộc project mà Leader này quản lý
                var projectIds = await _context.Projects
                    .Where(p => p.UserId == user.Id)
                    .Select(p => p.IdProject)
                    .ToListAsync();

                taskQuery = taskQuery.Where(t => projectIds.Contains(t.ProjectId));
            }
            else if (User.IsInRole("EMPLOYEE"))
            {
                // Employee chỉ thấy task gán cho mình
                taskQuery = taskQuery.Where(t => t.Assignee_Id == user.Id);
            }
            // 🔹 ADMIN thì giữ nguyên (xem tất cả)

            // 🔹 Lấy thống kê theo từng project
            // 3. Dùng GroupBy(t => 1) để tổng hợp 1 lần duy nhất
            var summary = await taskQuery
                .GroupBy(t => 1) // Nhóm tất cả task lại thành 1 nhóm
                .Select(g => new
                {
                    TotalTasks = g.Count(),
                    CompletedTasks = g.Count(t => t.Status.StatusName == TaskStatusModel.Done),
                    InProgressTasks = g.Count(t => t.Status.StatusName == TaskStatusModel.InProgress),
                    TodoTasks = g.Count(t => t.Status.StatusName == TaskStatusModel.Todo),
                    OverdueTasks = g.Count(t => t.EndDate < now && t.Status.StatusName != TaskStatusModel.Done)
                })
                .FirstOrDefaultAsync(); // Lấy 1 dòng kết quả duy nhất

            // 🔹 Cộng dồn tất cả project
            if (summary == null)
            {
                // Trả về 0 nếu không có task nào
                return Ok(new { TotalTasks = 0, CompletedTasks = 0, InProgressTasks = 0, TodoTasks = 0, OverdueTasks = 0 });
            }

            return Ok(summary);
        }
        #endregion

        #region GET: api/projects/statistics
        [HttpGet("api/projects/statistics")]
        public async Task<IActionResult> GetProjectsStatistics()
        {
            var now = DateTime.Now;

            // SỬA: Dùng GroupBy để lấy tất cả trong 1 truy vấn
            var stats = await _context.Projects
                .GroupBy(p => 1)
                .Select(g => new
                {
                    Completed = g.Count(p => p.Status.StatusName == TaskStatusModel.Done && p.EndDay >= now),
                    InProgress = g.Count(p => p.Status.StatusName == TaskStatusModel.InProgress && p.EndDay >= now),
                    Todo = g.Count(p => p.Status.StatusName == TaskStatusModel.Todo && p.EndDay >= now),
                    Overdue = g.Count(p => p.Status.StatusName != TaskStatusModel.Done && p.EndDay < now)
                })
                .FirstOrDefaultAsync();

            if (stats == null)
            {
                // Trả về 0 nếu không có project nào
                return Ok(new { Completed = 0, InProgress = 0, Todo = 0, Overdue = 0 });
            }

            return Ok(stats);
        }
        #endregion

        #region GET: api/projects/deadline - *Phân trang theo tháng*
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
                        p.Status.StatusName
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
                        p.Status.StatusName
                    }).ToListAsync();
                return Ok(deadlines);
            }
            return Ok();
        }
        #endregion

        #region GET: api/tasks/deadline  - *Phân trang theo tháng*
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
                    })
                    .ToListAsync();

                return Ok(deadlines);
            }
            else if (User.IsInRole("ADMIN"))
            {

                return Ok();
            }
            return Ok();
        }
        #endregion

        #region GET: api/projects
        [HttpGet("api/projects")]
        public async Task<IActionResult> GetProjects([FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 5)
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

            // THÊM: Đếm tổng
            var totalCount = await query.CountAsync();

            // SỬA: Thêm dòng tính totalPages
            var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);
            if (totalPages == 0) totalPages = 1; // Đảm bảo luôn có ít nhất 1 trang

            // 🔹 Truy vấn dữ liệu chung
            var projects = await query
                .OrderByDescending(p => p.EndDay)
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

        #region GET: api/projects/{idProject}/members
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

        #region GET: api/tasks
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

        #region GET: api/projects/{projectId}/tasks?pageIndex=1&pageSize=10
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
                .OrderByDescending(t => t.Priority) // Sắp xếp (ví dụ: ưu tiên cao lên đầu)
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

        #region
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

        #region POST: Home/SaveTask
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

        #region DELETE: Home/DeleteTask
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
