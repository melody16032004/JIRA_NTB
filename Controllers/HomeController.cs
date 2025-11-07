using JIRA_NTB.Data;
using JIRA_NTB.Models;
using JIRA_NTB.Models.Enums;
using JIRA_NTB.Models.Test;
using JIRA_NTB.ViewModels;
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

        public HomeController(ILogger<HomeController> logger, AppDbContext context)
        {
            _logger = logger;
            _context = context;
        }

        public IActionResult Index()
        {
            return View();
        }

        [HttpGet("api/projects")]
        public async Task<IActionResult> GetProjects()
        {
            var projects = await _context.Projects
                .Select(p => new
                {
                    p.IdProject,
                    p.ProjectName,
                    p.StartDay,
                    p.EndDay,
                    Status = p.Status.StatusName,
                    FileNote = p.FileNote,
                    note = p.Note,
                    Manager = p.Manager.FullName,
                    TotalTasks = p.Tasks.Count(),
                    CompletedTasks = p.Tasks.Count(t => t.Status.StatusName == TaskStatusModel.Done),
                    InProgressTasks = p.Tasks.Count(t => t.Status.StatusName == TaskStatusModel.InProgress),
                    TodoTasks = p.Tasks.Count(t => t.Status.StatusName == TaskStatusModel.Todo),
                    OverdueTasks = p.Tasks.Count(t => t.EndDate < new DateTime() || t.Overdue),
                })
                .ToListAsync();

            return Ok(projects);
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
        public async Task<IActionResult> GetTasks()
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

        [HttpGet("api/departments")]
        public async Task<IActionResult> GetDepartments()
        {
            var departments = await _context.Departments
                .Select(d => new
                {
                    d.IdDepartment,
                    d.DepartmentName,
                    Users = d.Users.Select(u => new { u.Id, u.FullName }).ToList()
                })
                .ToListAsync();

            return Ok(departments);
        }

        //public async Task<IActionResult> Index()
        //{
        //    var projects = await _context.Projects
        //                                 .Include(p => p.Status)
        //                                 .Include(p => p.Manager)
        //                                 .Include(p => p.Tasks!)
        //                                 .ThenInclude(s => s.Status)
        //                                 .Include(p => p.ProjectManagers!)
        //                                 .ThenInclude(u => u.User)
        //                                 .ToListAsync();
        //    var department = await _context.Departments
        //                              .Include(d => d.Users)
        //                              .ToListAsync();

        //    var vm = new DashboardViewModel
        //    {
        //        Projects = projects,
        //        Departments = department
        //    };

        //    ViewBag.ProjectsJson = JsonConvert.SerializeObject(projects, new JsonSerializerSettings
        //    {
        //        ReferenceLoopHandling = ReferenceLoopHandling.Ignore
        //    });
        //    ViewBag.DepartmentsJson = JsonConvert.SerializeObject(department, new JsonSerializerSettings
        //    {
        //        ReferenceLoopHandling = ReferenceLoopHandling.Ignore
        //    });

        //    if (projects != null)
        //    {
        //         return View(vm);
        //    }
        //    else
        //    {
        //        return View();
        //    }
        //}

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
    }
}
