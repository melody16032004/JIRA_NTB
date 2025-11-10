using JIRA_NTB.Data;
using JIRA_NTB.Models;
using JIRA_NTB.Models.Enums;
using JIRA_NTB.ViewModels;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using System;
using System.Diagnostics;
using System.Globalization;

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
            var user = await _userManager.GetUserAsync(User);

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

        [HttpGet("api/user/me")]
        public async Task<IActionResult> GetCurrentUser()
        {
            var user = await _userManager.GetUserAsync(User);
            return Ok(new {
                user.FullName,
            });
        }

        [HttpGet("api/tasks/statistics")]
        public async Task<IActionResult> GetTasksStatistics()
        {
            var user = await _userManager.GetUserAsync(User);
            var now = DateTime.Now;

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
            // 🔹 ADMIN thì giữ nguyên (xem tất cả)

            // 🔹 Lấy thống kê theo từng project
            var statsList = await query
                .Select(p => new
                {
                    TotalTasks = p.Tasks.Count(),
                    CompletedTasks = p.Tasks.Count(t => t.Status.StatusName == TaskStatusModel.Done),
                    InProgressTasks = p.Tasks.Count(t => t.Status.StatusName == TaskStatusModel.InProgress),
                    TodoTasks = p.Tasks.Count(t => t.Status.StatusName == TaskStatusModel.Todo),
                    OverdueTasks = p.Tasks.Count(t => t.EndDate < now && t.Status.StatusName != TaskStatusModel.Done)
                })
                .ToListAsync();

            // 🔹 Cộng dồn tất cả project
            var summary = new
            {
                TotalTasks = statsList.Sum(x => x.TotalTasks),
                CompletedTasks = statsList.Sum(x => x.CompletedTasks),
                InProgressTasks = statsList.Sum(x => x.InProgressTasks),
                TodoTasks = statsList.Sum(x => x.TodoTasks),
                OverdueTasks = statsList.Sum(x => x.OverdueTasks)
            };

            return Ok(summary);
        }

        [HttpGet("api/projects/statistics")]
        public async Task<IActionResult> GetProjectsStatistics()
        {
            var now = DateTime.Now;

            var stats = new
            {
                Completed = await _context.Projects.CountAsync(p => p.Status.StatusName == TaskStatusModel.Done && p.EndDay >= now),
                InProgress = await _context.Projects.CountAsync(p => p.Status.StatusName == TaskStatusModel.InProgress && p.EndDay >= now),
                Todo = await _context.Projects.CountAsync(p => p.Status.StatusName == TaskStatusModel.Todo && p.EndDay >= now),
                Overdue = await _context.Projects.CountAsync(p => p.Status.StatusName != TaskStatusModel.Done && p.EndDay < now),
            };

            return Ok(stats);
        }

        [HttpGet("api/projects/deadline")]
        public async Task<IActionResult> GetProjectsDeadline()
        {
            var deadlines = await _context.Projects
                .Select(p => new
                {
                    p.IdProject,
                    p.ProjectName,
                    p.EndDay,
                })
                .ToListAsync();

            return Ok(deadlines);
        }
        [HttpGet("api/tasks/deadline")]
        public async Task<IActionResult> GetTasksDeadline()
        {
            var deadlines = await _context.Tasks
                .Select(t => new
                {
                    t.IdTask,
                    t.NameTask,
                    t.Assignee.FullName,
                    t.EndDate,
                })
                .ToListAsync();
            
            return Ok(deadlines);
        }

        [HttpGet("api/projects")]
        public async Task<IActionResult> GetProjects(/*[FromQuery] int page = 1, [FromQuery] int pageSize = 10*/)
        {
            //var query = _context.Projects
            //    .OrderByDescending(p => p.StartDay) // Sắp xếp để phân trang có nghĩa
            //    .Select(p => new
            //    {
            //        p.IdProject,
            //        p.ProjectName,
            //        p.StartDay,
            //        p.EndDay,
            //        Status = p.Status.StatusName,
            //        p.FileNote,
            //        note = p.Note,
            //        Manager = p.Manager.FullName,
            //        // Các phép đếm này có thể làm chậm nếu CSDL lớn (N+1 query)
            //        // Cân nhắc cache hoặc pre-calculate các con số này
            //        TotalTasks = p.Tasks.Count(),
            //        CompletedTasks = p.Tasks.Count(t => t.Status.StatusName == TaskStatusModel.Done),
            //        InProgressTasks = p.Tasks.Count(t => t.Status.StatusName == TaskStatusModel.InProgress),
            //        TodoTasks = p.Tasks.Count(t => t.Status.StatusName == TaskStatusModel.Todo),
            //        OverdueTasks = p.Tasks.Count(t => t.EndDate < DateTime.Now || t.Overdue),
            //    });

            //var totalItems = await query.CountAsync();
            //var projects = await query
            //    .Skip((page - 1) * pageSize)
            //    .Take(pageSize)
            //    .ToListAsync();

            //return Ok(new
            //{
            //    Items = projects,
            //    TotalPages = (int)Math.Ceiling(totalItems / (double)pageSize),
            //    CurrentPage = page
            //});
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

            // 🔹 Truy vấn dữ liệu chung
            var projects = await query
                .Select(p => new
                {
                    p.IdProject,
                    p.ProjectName,
                    p.StartDay,
                    p.EndDay,
                    Status = p.Status.StatusName,
                    FileNote = p.FileNote,
                    Note = p.Note,
                    Manager = p.Manager.FullName
                })
                .ToListAsync();

            return Ok(projects);

            //if (User.IsInRole("ADMIN"))
            //{
            //    var projects = await _context.Projects
            //    .Select(p => new
            //    {
            //        p.IdProject,
            //        p.ProjectName,
            //        p.StartDay,
            //        p.EndDay,
            //        Status = p.Status.StatusName,
            //        FileNote = p.FileNote,
            //        note = p.Note,
            //        Manager = p.Manager.FullName,
            //        TotalTasks = p.Tasks.Count(),
            //        CompletedTasks = p.Tasks.Count(t => t.Status.StatusName == TaskStatusModel.Done),
            //        InProgressTasks = p.Tasks.Count(t => t.Status.StatusName == TaskStatusModel.InProgress),
            //        TodoTasks = p.Tasks.Count(t => t.Status.StatusName == TaskStatusModel.Todo),
            //        OverdueTasks = p.Tasks.Count(t => t.EndDate < new DateTime() || t.Overdue),
            //    })
            //    .ToListAsync();
            //    return Ok(projects);
            //}
            //else if (User.IsInRole("LEADER"))
            //{
            //    var projects = await _context.Projects
            //    .Where(p => p.UserId == user.Id)
            //    .Select(p => new
            //    {
            //        p.IdProject,
            //        p.ProjectName,
            //        p.StartDay,
            //        p.EndDay,
            //        Status = p.Status.StatusName,
            //        FileNote = p.FileNote,
            //        note = p.Note,
            //        Manager = p.Manager.FullName,
            //        TotalTasks = p.Tasks.Count(),
            //        CompletedTasks = p.Tasks.Count(t => t.Status.StatusName == TaskStatusModel.Done),
            //        InProgressTasks = p.Tasks.Count(t => t.Status.StatusName == TaskStatusModel.InProgress),
            //        TodoTasks = p.Tasks.Count(t => t.Status.StatusName == TaskStatusModel.Todo),
            //        OverdueTasks = p.Tasks.Count(t => t.EndDate < new DateTime() || t.Overdue),
            //    })
            //    .ToListAsync();

            //    return Ok(projects);
            //}
            //else if (User.IsInRole("EMPLOYEE"))
            //{
            //    var projectIds = await _context.ProjectManagers
            //        .Where(pm => pm.UserId == user.Id)
            //        .Select(pm => pm.ProjectId)
            //        .ToListAsync();

            //    var projects = await _context.Projects
            //        .Where(p => projectIds.Contains(p.IdProject))
            //        .Select(p => new
            //        {
            //            p.IdProject,
            //            p.ProjectName,
            //            p.StartDay,
            //            p.EndDay,
            //            Status = p.Status.StatusName,
            //            FileNote = p.FileNote,
            //            note = p.Note,
            //            Manager = p.Manager.FullName,
            //            TotalTasks = p.Tasks.Count(),
            //            CompletedTasks = p.Tasks.Count(t => t.Status.StatusName == TaskStatusModel.Done),
            //            InProgressTasks = p.Tasks.Count(t => t.Status.StatusName == TaskStatusModel.InProgress),
            //            TodoTasks = p.Tasks.Count(t => t.Status.StatusName == TaskStatusModel.Todo),
            //            OverdueTasks = p.Tasks.Count(t => t.EndDate < new DateTime() || t.Overdue),
            //        })
            //        .ToListAsync();

            //    return Ok(projects);
            //}
        }

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

        [HttpGet("api/tasks")]
        public async Task<IActionResult> GetTasks(/*[FromQuery] string projectId*/)
        {
            // Bắt buộc phải có projectId để tránh tải tất cả
            //if (string.IsNullOrEmpty(projectId))
            //{
            //    return BadRequest(new { message = "projectId is required." });
            //}

            //var tasks = await _context.Tasks
            //    .Where(t => t.ProjectId == projectId) // Chỉ tải task của dự án được yêu cầu
            //    .Select(t => new
            //    {
            //        t.IdTask,
            //        t.NameTask,
            //        t.Priority,
            //        t.Overdue,
            //        t.FileNote,
            //        t.Note,
            //        t.StartDate,
            //        t.EndDate,
            //        t.Assignee_Id,
            //        t.ProjectId,
            //        t.Project.ProjectName,
            //        t.Status.StatusName,
            //        NameAssignee = t.Assignee.FullName,
            //    })
            //    .ToListAsync();

            //return Ok(tasks);
            var user = await _userManager.GetUserAsync(User);
            if (User.IsInRole("ADMIN"))
            {
                var tasks = await _context.Tasks
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
                    t.Project.ProjectName,
                    t.Status.StatusName,
                    NameAssignee = t.Assignee.FullName,

                })
                .ToListAsync();

                return Ok(tasks);
            }
            else if (User.IsInRole("LEADER"))
            {
                var projectIdsByLeader = await _context.Projects
                    .Where(p => p.UserId == user.Id)
                    .Select(p => p.IdProject)
                    .ToListAsync();

                var tasks = await _context.Tasks
                    .Where(t => projectIdsByLeader.Contains(t.ProjectId))
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
                        t.Project.ProjectName,
                        t.Status.StatusName,
                        NameAssignee = t.Assignee.FullName,

                    })
                    .ToListAsync();

                return Ok(tasks);
            }
            else
            {
                var projectIds = await _context.ProjectManagers
                    .Where(pm => pm.UserId == user.Id)
                    .Select(pm => pm.ProjectId)
                    .ToListAsync();

                var tasks = await _context.Tasks
                    .Where(t => projectIds.Contains(t.ProjectId) && t.Assignee_Id == user.Id)
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
                        t.Project.ProjectName,
                        t.Status.StatusName,
                        NameAssignee = t.Assignee.FullName,

                    })
                    .ToListAsync();

                return Ok(tasks);
            }
            
        }

        // ==================== API: Thêm hoặc Cập nhật Task ====================
        [HttpPost]
        public async Task<IActionResult> SaveTask([FromBody] TaskObjectViewModel model)
        {
            //if (model == null)
            //{
            //    return BadRequest(new { success = false, message = "Dữ liệu gửi lên không hợp lệ." });
            //}

            //// Validate StatusId (phải là "1", "2", hoặc "3")
            ////if (model.Status != TaskStatusModel.Todo.ToString() && 
            ////    model.Status != TaskStatusModel.InProgress.ToString() && 
            ////    model.Status != TaskStatusModel.Done.ToString())
            ////{
            ////    return BadRequest(new { success = false, message = "Trạng thái không hợp lệ." });
            ////}

            //try
            //{
            //    var existingTask = await _context.Tasks.FirstOrDefaultAsync(t => t.IdTask == model.Id);

            //    if (existingTask != null)
            //    {
            //        // --- Cập nhật ---
            //        existingTask.Note = model.Desc;
            //        existingTask.EndDate = DateTime.ParseExact(model.End, "yyyy-MM-dd", CultureInfo.InvariantCulture);
            //        existingTask.FileNote = model.File;
            //        existingTask.Assignee_Id = model.IdAss;
            //        existingTask.ProjectId = model.IdPrj;
            //        existingTask.NameTask = model.Name;
            //        existingTask.Priority = model.Prior;
            //        existingTask.StartDate = DateTime.ParseExact(model.Start, "yyyy-MM-dd", CultureInfo.InvariantCulture);
            //        existingTask.StatusId = model.Status; // StatusId giờ đã là "1", "2", hoặc "3"

            //        _context.Tasks.Update(existingTask);
            //    }
            //    else
            //    {
            //        // --- Thêm mới ---
            //        var newTask = new TaskItemModel
            //        {
            //            IdTask = model.Id,
            //            Note = model.Desc,
            //            EndDate = DateTime.ParseExact(model.End, "yyyy-MM-dd", CultureInfo.InvariantCulture),
            //            FileNote = model.File,
            //            Assignee_Id = model.IdAss ?? null,
            //            ProjectId = model.IdPrj,
            //            NameTask = model.Name,
            //            Priority = model.Prior,
            //            StartDate = DateTime.ParseExact(model.Start, "yyyy-MM-dd", CultureInfo.InvariantCulture),
            //            StatusId = model.Status, // StatusId là "1", "2", hoặc "3"
            //        };
            //        await _context.Tasks.AddAsync(newTask);
            //    }

            //    await _context.SaveChangesAsync();
            //    return Ok(new { success = true, message = "Lưu task thành công!" });
            //}
            //catch (Exception ex)
            //{
            //    // Log lỗi chi tiết hơn
            //    _logger.LogError(ex, "Lỗi khi SaveTask: {ErrorMessage}", ex.Message);
            //    return StatusCode(500, new { success = false, message = ex.Message });
            //}
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


        // =================================================================
        // MỚI: API SIÊU NHANH CHO SUMMARY (THẺ + BIỂU ĐỒ)
        // =================================================================
        [HttpGet("api/dashboard/summary")]
        public async Task<IActionResult> GetDashboardSummary()
        {
            var projectSummary = await _context.Projects
                .GroupBy(p => 1) // Nhóm tất cả lại để đếm
                .Select(g => new
                {
                    CountProject = g.Count(),
                    CountProjectDone = g.Count(p => p.Status.StatusName == TaskStatusModel.Done),
                    CountToDo = g.Count(p => p.Status.StatusName == TaskStatusModel.Todo),
                    CountInProgress = g.Count(p => p.Status.StatusName == TaskStatusModel.InProgress),
                    // Đếm Overdue chính xác bằng SQL
                    CountOverdue = g.Count(p => p.EndDay < DateTime.Now && p.Status.StatusName != TaskStatusModel.Done)
                }).FirstOrDefaultAsync();

            var taskSummary = await _context.Tasks
                .GroupBy(t => 1)
                .Select(g => new
                {
                    CountTask = g.Count(),
                    CountTaskDone = g.Count(t => t.Status.StatusName == TaskStatusModel.Done),
                    CountTaskInProgress = g.Count(t => t.Status.StatusName == TaskStatusModel.InProgress),
                    CountTaskTodo = g.Count(t => t.Status.StatusName == TaskStatusModel.Todo),
                    CountTaskOverDue = g.Count(t => t.EndDate < DateTime.Now || t.Overdue)
                }).FirstOrDefaultAsync();

            // Nếu không có dự án/task nào, gán giá trị 0
            var emptyProjectSummary = new { CountProject = 0, CountProjectDone = 0, CountToDo = 0, CountInProgress = 0, CountOverdue = 0 };
            var emptyTaskSummary = new { CountTask = 0, CountTaskDone = 0, CountTaskInProgress = 0, CountTaskTodo = 0, CountTaskOverDue = 0 };

            return Ok(new
            {
                ProjectSummary = projectSummary ?? emptyProjectSummary,
                TaskSummary = taskSummary ?? emptyTaskSummary
            });
        }


    }
}
