using JIRA_NTB.Data;
using JIRA_NTB.Models;
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

        public async Task<IActionResult> Index()
        {
            var projects = await _context.Projects
                                         .Include(p => p.Status)
                                         .Include(p => p.Manager)
                                         .Include(p => p.Tasks!)
                                         .ThenInclude(s => s.Status)
                                         .Include(p => p.ProjectManagers!)
                                         .ThenInclude(u => u.User)
                                         .ToListAsync();
            var department = await _context.Departments
                                      .Include(d => d.Users)
                                      .ToListAsync();

            var vm = new DashboardViewModel
            {
                Projects = projects,
                Departments = department
            };

            ViewBag.ProjectsJson = JsonConvert.SerializeObject(projects, new JsonSerializerSettings
            {
                ReferenceLoopHandling = ReferenceLoopHandling.Ignore
            });
            ViewBag.DepartmentsJson = JsonConvert.SerializeObject(department, new JsonSerializerSettings
            {
                ReferenceLoopHandling = ReferenceLoopHandling.Ignore
            });

            if (projects != null)
            {
                return View(vm);
            }
            else
            {
                return View();
            }
        }

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
                        IdTask = Guid.NewGuid().ToString(),
                        Note = model.Desc,
                        EndDate = DateTime.ParseExact(model.End, "yyyy-MM-dd", CultureInfo.InvariantCulture),
                        FileNote = model.File,
                        Assignee_Id = model.IdAss,
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


        public IActionResult Privacy()
        {
            return View();
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }
    }
}
