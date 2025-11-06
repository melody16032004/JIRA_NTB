using JIRA_NTB.Data;
using JIRA_NTB.Helpers;
using JIRA_NTB.Models;
using JIRA_NTB.Models.Enums;
using JIRA_NTB.ViewModels;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace JIRA_NTB.Controllers
{
    public class ProjectController : Controller
    {
        private readonly AppDbContext _context;

        public ProjectController(AppDbContext context)
        {
            _context = context;
        }

        // GET: Project
        public async Task<IActionResult> Index(string searchQuery, string filterStatusId)
        {
            var query = _context.Projects
                .Include(p => p.Status)
                .Include(p => p.Manager)
                .Include(p => p.ProjectManagers)
                    .ThenInclude(pm => pm.User)
                .Include(p => p.Tasks)
                    .ThenInclude(t => t.Status)
                .AsQueryable();

            // Tìm kiếm theo tên
            if (!string.IsNullOrWhiteSpace(searchQuery))
            {
                query = query.Where(p => p.ProjectName.Contains(searchQuery));
            }

            var projects = await query
                .OrderByDescending(p => p.StartDay)
                .ToListAsync();

            var allStatuses = await _context.Statuses.ToListAsync();

            var viewModel = new ProjectListViewModel
            {
                SearchQuery = searchQuery,
                FilterStatusId = filterStatusId,
                
                AllStatuses = allStatuses,
                Projects = projects.Select(p => new ProjectCardViewModel
                {
                    IdProject = p.IdProject,
                    ProjectName = p.ProjectName,
                    StartDay = p.StartDay,
                    EndDay = p.EndDay,
                    CompletedDate = p.CompletedDate,
                    StatusId = p.StatusId,
                    StatusName = p.Status?.StatusName.ToString() ?? "Không xác định",
                    ProjectManager = p.Manager != null ? new MemberAvatarViewModel
                    {
                        UserId = p.Manager.Id, 
                        UserName = p.Manager.FullName ?? "Chưa có",
                        AvatarUrl = p.Manager.Avt  
                    } : null, 
                    Progress = CalculateProgress(p),
                    TotalMembers = p.ProjectManagers?.Count ?? 0,
                    Members = (p.ProjectManagers ?? new List<ProjectManagerModel>())
                        .Take(4)
                        .Select(pm => new MemberAvatarViewModel
                        {
                            UserId = pm.UserId,
                            UserName = pm.User?.FullName ?? "Unknown",
                            AvatarUrl = pm.User?.Avt ?? "https://i.pravatar.cc/150?img=1"
                        }).ToList()
                }).ToList()
            };

            // ✅ Lọc sau khi ánh xạ enum → StatusId thật
            if (!string.IsNullOrEmpty(filterStatusId) && int.TryParse(filterStatusId, out var statusValue))
            {
                var statusEnum = (TaskStatusModel)statusValue;
                string statusKey = statusEnum switch
                {
                    TaskStatusModel.Todo => "status-todo",
                    TaskStatusModel.InProgress => "status-inprogress",
                    TaskStatusModel.Done => "status-done",
                    _ => ""
                };

                viewModel.Projects = viewModel.Projects
                    .Where(p => (p.StatusId ?? "").Equals(statusKey, StringComparison.OrdinalIgnoreCase))
                    .ToList();
            }
            // Nếu là request từ AJAX (do jQuery gửi lên)
            if (Request.Headers["X-Requested-With"] == "XMLHttpRequest")
            {
                // Chỉ trả về HTML của Partial View
                return PartialView("~/Views/Project/Partial/_ProjectListPartial.cshtml", viewModel);
            }
            


            viewModel.NewProject = new ProjectModel
            {
                IdProject = string.Empty,
                ProjectName = string.Empty
            };
            // 2. Tải danh sách Users cho dropdown quản lý
            viewModel.AvailableUsers = await _context.Users
                .OrderBy(u => u.FullName)
                .Select(u => new SelectListItem
                {
                    Value = u.Id,
                    Text = u.FullName ?? u.Email // Hiển thị FullName hoặc Email
                })
                .ToListAsync();

            // 3. Tải danh sách Statuses (tận dụng biến allStatuses bạn đã lấy)
            viewModel.AvailableStatuses = allStatuses
                .Select(s => new SelectListItem
                {
                    Value = s.StatusId, // Giả sử StatusId là "status-todo", "status-inprogress"
                    Text = s.StatusName.ToString() // Hiển thị tên trạng thái
                })
                .ToList();



            return View(viewModel);
        }


        //public async Task<IActionResult> Details(string id)
        //{
        //    if (string.IsNullOrEmpty(id))
        //    {
        //        return NotFound();
        //    }

        //    // 1. Lấy thông tin dự án
        //    var project = await _context.Projects
        //        .Include(p => p.Manager)
        //        .Include(p => p.Status) // Status của Project
        //        .FirstOrDefaultAsync(p => p.IdProject == id);

        //    if (project == null)
        //    {
        //        return NotFound();
        //    }

        //    // 2. Lấy danh sách thành viên
        //    var members = await _context.ProjectManagers
        //        .Where(pm => pm.ProjectId == id)
        //        .Include(pm => pm.User)
        //        .Select(pm => pm.User)
        //        .ToListAsync();

        //    // 3. Lấy tất cả Task của dự án (QUAN TRỌNG: Include Status của Task)
        //    var tasks = await _context.Tasks
        //        .Include(t => t.Status) // Phải Include Status (object) CỦA TASK
        //        .Where(t => t.ProjectId == id)
        //        .ToListAsync();

        //    // 4. Xử lý dữ liệu cho biểu đồ
        //    var taskStatusData = tasks
        //        .Where(t => t.Status != null) // Lọc ra các task có status
        //        .GroupBy(t => t.Status.StatusName) // Group by StatusName (là INT 1, 2, 3)
        //        .Select(group => new
        //        {
        //            StatusEnumAsInt = group.Key, // Key bây giờ là INT (1, 2, 3)
        //            Count = group.Count()
        //        })
        //        .AsEnumerable() // Chuyển sang xử lý in-memory để dùng switch/cast
        //        .Select(d => new
        //        {
        //            // === SỬA LỖI TẠI ĐÂY ===
        //            // Chuyển INT (1, 2, 3) thành string ("Lên kế hoạch", ...)
        //            // một cách an toàn bằng cách cast về Enum
        //            StatusLabel = ((TaskStatusModel)d.StatusEnumAsInt) switch
        //            {
        //                TaskStatusModel.Todo => "Lên kế hoạch",
        //                TaskStatusModel.InProgress => "Đang thực hiện",
        //                TaskStatusModel.Done => "Hoàn thành",
        //                _ => "Không xác định"
        //            },
        //            Count = d.Count
        //        })
        //        .OrderBy(x => x.StatusLabel); // Sắp xếp theo tên cho đẹp

        //    // 5. Tạo ViewModel
        //    var viewModel = new ProjectDetailViewModel
        //    {
        //        Project = project,
        //        Members = members,
        //        Tasks = tasks,
        //        TaskStatusChart = new ChartData
        //        {
        //            // Gán StatusLabel (string) vào Labels
        //            Labels = taskStatusData.Select(d => d.StatusLabel).ToList(),
        //            Series = taskStatusData.Select(d => d.Count).ToList()
        //        }
        //    };

        //    return View(viewModel);
        //}
        public async Task<IActionResult> Details(string id)
        {
            if (string.IsNullOrEmpty(id))
            {
                return NotFound();
            }

            // 1. Thông tin dự án
            var project = await _context.Projects
                .Include(p => p.Manager)
                .Include(p => p.Status)
                .FirstOrDefaultAsync(p => p.IdProject == id);

            if (project == null)
            {
                return NotFound();
            }

            // 2. Thành viên
            var members = await _context.ProjectManagers
                .Where(pm => pm.ProjectId == id)
                .Include(pm => pm.User)
                .Select(pm => pm.User)
                .ToListAsync();

            // 3. Task của dự án
            var tasks = await _context.Tasks
                .Include(t => t.Status)
                .Include(t => t.Assignee)
                .Where(t => t.ProjectId == id)
                .ToListAsync();

            // 4. Biểu đồ trạng thái
            var taskStatusData = tasks
                .Where(t => t.Status != null) // Lọc ra các task có status
                .GroupBy(t => t.Status.StatusName) // Group by StatusName (là INT 1, 2, 3)
                .Select(group => new
                {
                    StatusEnumAsInt = group.Key, // Key bây giờ là INT (1, 2, 3)
                    Count = group.Count()
                })
                .AsEnumerable() // Chuyển sang xử lý in-memory để dùng switch/cast
                .Select(d => new
                {
                    // === SỬA LỖI TẠI ĐÂY ===
                    // Chuyển INT (1, 2, 3) thành string ("Lên kế hoạch", ...)
                    // một cách an toàn bằng cách cast về Enum
                    StatusLabel = ((TaskStatusModel)d.StatusEnumAsInt) switch
                    {
                        TaskStatusModel.Todo => "Lên kế hoạch",
                        TaskStatusModel.InProgress => "Đang thực hiện",
                        TaskStatusModel.Done => "Hoàn thành",
                        _ => "Không xác định"
                    },
                    Count = d.Count
                })
                .OrderBy(x => x.StatusLabel); // Sắp xếp theo tên cho đẹp

            // 5. Biểu đồ thời gian (Gantt)
            var ganttData = tasks
                .Where(t => t.StartDate != null && t.EndDate != null)
                .Select(t => new GanttTaskData
                {
                    Name = t.NameTask,
                    Assignee = t.Assignee?.FullName ?? "Chưa giao",
                    Priority = t.Priority ?? "Medium",
                    Start = ((DateTimeOffset)t.StartDate.Value).ToUnixTimeMilliseconds(),
                    End = ((DateTimeOffset)t.EndDate.Value).ToUnixTimeMilliseconds(),
                    Overdue = (t.EndDate < DateTime.Now && t.StatusId != TaskStatusModel.Done.ToString()),
                    Status = t.Status != null ? 
                        (((TaskStatusModel)t.Status.StatusName) switch
                        {
                            TaskStatusModel.Todo => "Lên kế hoạch",
                            TaskStatusModel.InProgress => "Đang thực hiện",
                            TaskStatusModel.Done => "Hoàn thành",
                            _ => "Không xác định"
                        }) : "Không xác định"
                })
                .ToList();

            // 6. ViewModel
            var viewModel = new ProjectDetailViewModel
            {
                Project = project,
                Members = members,
                Tasks = tasks,
                TaskStatusChart = new ChartData
                {
                    Labels = taskStatusData.Select(d => d.StatusLabel).ToList(),
                    Series = taskStatusData.Select(d => d.Count).ToList()
                },
                TaskTimelineData = ganttData
            };

            return View(viewModel);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(ProjectModel NewProject)
        {
            // Xóa validate không cần thiết
            ModelState.Remove("IdProject");
            ModelState.Remove("Manager");
            ModelState.Remove("Status");
            ModelState.Remove("Tasks");
            ModelState.Remove("ProjectManagers");
            ModelState.Remove("FileNote");
            ModelState.Remove("CompletedDate");

            if (!ModelState.IsValid)
            {
                foreach (var kvp in ModelState)
                {
                    foreach (var err in kvp.Value.Errors)
                    {
                        Console.WriteLine($"Field: {kvp.Key} → {err.ErrorMessage}");
                    }
                }
                return RedirectToAction(nameof(Index));
            }

            try
            {
                _context.Projects.Add(NewProject);
                await _context.SaveChangesAsync();
                Console.WriteLine("Project saved successfully!");
            }
            catch (Exception ex)
            {
                Console.WriteLine("Save error: " + ex.Message);
            }

            return RedirectToAction(nameof(Index));
        }


        // GET: Project/Edit/5
        public async Task<IActionResult> Edit(string id)
        {
            if (string.IsNullOrEmpty(id))
            {
                return NotFound();
            }

            var project = await _context.Projects.FindAsync(id);
            if (project == null)
            {
                return NotFound();
            }

            ViewBag.Statuses = await _context.Statuses.ToListAsync();
            ViewBag.Users = await _context.Users.ToListAsync();
            return View(project);
        }

        // POST: Project/Edit/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Edit(string id, ProjectModel project)
        {
            if (id != project.IdProject)
            {
                return NotFound();
            }

            if (ModelState.IsValid)
            {
                try
                {
                    _context.Update(project);
                    await _context.SaveChangesAsync();
                }
                catch (DbUpdateConcurrencyException)
                {
                    if (!ProjectExists(project.IdProject))
                    {
                        return NotFound();
                    }
                    else
                    {
                        throw;
                    }
                }
                return RedirectToAction(nameof(Index));
            }

            ViewBag.Statuses = await _context.Statuses.ToListAsync();
            ViewBag.Users = await _context.Users.ToListAsync();
            return View(project);
        }

        // GET: Project/Delete/5
        public async Task<IActionResult> Delete(string id)
        {
            if (string.IsNullOrEmpty(id))
            {
                return NotFound();
            }

            var project = await _context.Projects
                .Include(p => p.Status)
                .Include(p => p.Manager)
                .FirstOrDefaultAsync(m => m.IdProject == id);

            if (project == null)
            {
                return NotFound();
            }

            return View(project);
        }

        // POST: Project/Delete/5
        [HttpPost, ActionName("Delete")]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> DeleteConfirmed(string id)
        {
            var project = await _context.Projects.FindAsync(id);
            if (project != null)
            {
                _context.Projects.Remove(project);
                await _context.SaveChangesAsync();
            }

            return RedirectToAction(nameof(Index));
        }

        private bool ProjectExists(string id)
        {
            return _context.Projects.Any(e => e.IdProject == id);
        }

        // Helper method to calculate progress
        private int CalculateProgress(ProjectModel project)
        {
            // Nếu đã hoàn thành
            if (project.CompletedDate.HasValue)
                return 100;

            // Tính toán dựa trên số tasks đã hoàn thành
            // (Đảm bảo action Index đã .Include(p => p.Tasks).ThenInclude(t => t.Status))
            if (project.Tasks != null && project.Tasks.Any())
            {
                var totalTasks = project.Tasks.Count;
                if (totalTasks == 0) return 0;

                // === ĐÂY LÀ PHẦN SỬA LỖI ===
                // So sánh t.Status.StatusName (là INT) 
                // với (int)TaskStatusModel.Done (cũng là INT, giá trị là 3)
                var completedTasks = project.Tasks.Count(t =>
                    t.Status != null &&
                    t.Status.StatusName == JIRA_NTB.Models.Enums.TaskStatusModel.Done); 
                // ============================

                return (int)((double)completedTasks / totalTasks * 100);
            }

            // Nếu chưa bắt đầu
            if (!project.StartDay.HasValue || project.StartDay > DateTime.Now)
                return 0;

            // Tính toán dựa trên thời gian nếu không có tasks
            if (project.StartDay.HasValue && project.EndDay.HasValue)
            {
                var totalDays = (project.EndDay.Value - project.StartDay.Value).TotalDays;
                if (totalDays <= 0) return 0; // Tránh chia cho 0

                var elapsedDays = (DateTime.Now - project.StartDay.Value).TotalDays;
                var progress = (int)((elapsedDays / totalDays) * 100);
                return Math.Min(Math.Max(progress, 0), 99); // Giới hạn từ 0-99%
            }

            return 0;
        }
    }
}