using JIRA_NTB.Data;
using JIRA_NTB.Helpers;
using JIRA_NTB.Models;
using JIRA_NTB.Models.Enums;
using JIRA_NTB.Repository;
using JIRA_NTB.ViewModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Text.RegularExpressions;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace JIRA_NTB.Controllers
{
    [Authorize]
    public class ProjectController : Controller
    {
        private readonly AppDbContext _context;
        private readonly IProjectService _projectService;
        private readonly UserManager<UserModel> _userManager;
        private readonly IStatusRepository _statusRepository;
        public ProjectController(UserManager<UserModel> userManager,AppDbContext context, IProjectService projectService, IStatusRepository statusRepository)
        {
            _context = context; // Dùng cho Index và các action cũ
            _projectService = projectService; // Dùng cho Details
            _userManager = userManager;
            _statusRepository = statusRepository;
        }

        // GET: Project
        [Authorize(Roles = "ADMIN,LEADER")]
        public async Task<IActionResult> Index(string searchQuery, string filterStatusId)
        {
            var user = await _userManager.GetUserAsync(User);
            var role = await _userManager.GetRolesAsync(user);
            var query = _context.Projects
                .Include(p => p.Status)
                .Include(p => p.Manager)
                .Include(p => p.ProjectManagers)
                    .ThenInclude(pm => pm.User)
                .Include(p => p.Tasks)
                    .ThenInclude(t => t.Status)
                .AsQueryable();
            if (role.Contains("LEADER"))
            {
                // Nếu là Leader, chỉ xem dự án trong phòng ban của mình
                query = query.Where(p => p.UserId == user.Id);
            }
            query = query.Where(p => p.StatusId != "Deleted");
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
            // 4. Tải danh sách Departments cho filter
            viewModel.AvailableDepartments = await _context.Departments
                .OrderBy(d => d.DepartmentName)
                .Select(d => new SelectListItem { Value = d.IdDepartment, Text = d.DepartmentName })
                .ToListAsync();

            // load leaders for initial dropdown (all leaders)
            var leaderRole = await _context.Roles.FirstOrDefaultAsync(r => r.NormalizedName == "LEADER" || r.Name == "Leader");
            if (leaderRole != null)
            {
                var leaderUserIds = await _context.UserRoles.Where(ur => ur.RoleId == leaderRole.Id).Select(ur => ur.UserId).ToListAsync();
                viewModel.AvailableLeaders = await _context.Users
                    .Where(u => leaderUserIds.Contains(u.Id))
                    .OrderBy(u => u.FullName)
                    .Select(u => new SelectListItem { Value = u.Id, Text = (u.FullName ?? u.UserName) + (u.IdDepartment != null ? $" ({u.IdDepartment})" : "") })
                    .ToListAsync();
            }
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
        //public async Task<IActionResult> Details(string id)
        //{
        //    if (string.IsNullOrEmpty(id))
        //    {
        //        return NotFound();
        //    }

        //    // 1. Thông tin dự án
        //    var project = await _context.Projects
        //        .Include(p => p.Manager)
        //        .Include(p => p.Status)
        //        .FirstOrDefaultAsync(p => p.IdProject == id);

        //    if (project == null)
        //    {
        //        return NotFound();
        //    }

        //    // 2. Thành viên
        //    var members = await _context.ProjectManagers
        //        .Where(pm => pm.ProjectId == id)
        //        .Include(pm => pm.User)
        //        .Select(pm => pm.User)
        //        .ToListAsync();

        //    // 3. Task của dự án
        //    var tasks = await _context.Tasks
        //        .Include(t => t.Status)
        //        .Include(t => t.Assignee)
        //        .Where(t => t.ProjectId == id)
        //        .ToListAsync();

        //    // 4. Biểu đồ trạng thái
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

        //    // 5. Biểu đồ thời gian (Gantt)
        //    var ganttData = tasks
        //        .Where(t => t.StartDate != null && t.EndDate != null)
        //        .Select(t => new GanttTaskData
        //        {
        //            Name = t.NameTask,
        //            Assignee = t.Assignee?.FullName ?? "Chưa giao",
        //            Priority = t.Priority ?? "Medium",
        //            Start = ((DateTimeOffset)t.StartDate.Value).ToUnixTimeMilliseconds(),
        //            End = ((DateTimeOffset)t.EndDate.Value).ToUnixTimeMilliseconds(),
        //            Overdue = (t.EndDate < DateTime.Now && t.StatusId != TaskStatusModel.Done.ToString()),
        //            Status = t.Status != null ? 
        //                (((TaskStatusModel)t.Status.StatusName) switch
        //                {
        //                    TaskStatusModel.Todo => "Lên kế hoạch",
        //                    TaskStatusModel.InProgress => "Đang thực hiện",
        //                    TaskStatusModel.Done => "Hoàn thành",
        //                    _ => "Không xác định"
        //                }) : "Không xác định"
        //        })
        //        .ToList();

        //    // 6. ViewModel
        //    var viewModel = new ProjectDetailViewModel
        //    {
        //        Project = project,
        //        Members = members,
        //        Tasks = tasks,
        //        TaskStatusChart = new ChartData
        //        {
        //            Labels = taskStatusData.Select(d => d.StatusLabel).ToList(),
        //            Series = taskStatusData.Select(d => d.Count).ToList()
        //        },
        //        TaskTimelineData = ganttData
        //    };

        //    return View(viewModel);
        //}
        public async Task<IActionResult> Details(string id)
        {
            if (string.IsNullOrEmpty(id))
            {
                return NotFound();
            }

            // 🎯 GỌN GÀNG: Chỉ cần gọi Service
            var viewModel = await _projectService.GetProjectDetailAsync(id);

            if (viewModel.Project == null)
            {
                return NotFound();
            }

            return View(viewModel);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(ProjectModel NewProject)
        {
            // Bỏ qua các validate không cần
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
                // Bước 1: lưu Project trước để có IdProject
                _context.Projects.Add(NewProject);
                await _context.SaveChangesAsync();
                Console.WriteLine("Project saved successfully: " + NewProject.IdProject);

                // Bước 2: nếu có MembersInput → tách @username
                if (!string.IsNullOrWhiteSpace(NewProject.MembersInput))
                {

                    var matches = Regex.Matches(NewProject.MembersInput, @"#([A-Za-z0-9_.-@]+)");
                    var usernames = matches
                        .Select(m => m.Groups[1].Value)
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToList();

                    if (usernames.Any())
                    {
                        // Lấy userId tương ứng
                        var users = await _context.Users
                            .Where(u => usernames.Contains(u.UserName))
                            .ToListAsync();

                        foreach (var u in users)
                        {
                            var pm = new ProjectManagerModel
                            {
                                ProjectId = NewProject.IdProject,
                                UserId = u.Id
                            };
                            _context.ProjectManagers.Add(pm);
                            Console.WriteLine($"➕ Added member {u.UserName} to Project {NewProject.IdProject}");
                        }

                        await _context.SaveChangesAsync();
                    }
                }

                Console.WriteLine(" Project and members saved successfully!");
            }
            catch (Exception ex)
            {
                Console.WriteLine(" Save error: " + ex.Message);
            }

            return RedirectToAction(nameof(Index));
        }



        //// POST: Project/Delete/5
        //[HttpPost, ActionName("Delete")]
        //[ValidateAntiForgeryToken]
        //public async Task<IActionResult> DeleteConfirmed(string id)
        //{
        //    var project = await _context.Projects.FindAsync(id);
        //    if (project != null)
        //    {
        //        _context.Projects.Remove(project);
        //        await _context.SaveChangesAsync();
        //    }

        //    return RedirectToAction(nameof(Index));
        //}

        private bool ProjectExists(string id)
        {
            return _context.Projects.Any(e => e.IdProject == id);
        }

        // Helper method to calculate progress
        //private int CalculateProgress(ProjectModel project)
        //{
        //    // Nếu đã hoàn thành
        //    if (project.CompletedDate.HasValue)
        //        return 100;

        //    // Tính toán dựa trên số tasks đã hoàn thành
        //    // (Đảm bảo action Index đã .Include(p => p.Tasks).ThenInclude(t => t.Status))
        //    if (project.Tasks != null && project.Tasks.Any())
        //    {
        //        var totalTasks = project.Tasks.Count;
        //        if (totalTasks == 0) return 0;

        //        // === ĐÂY LÀ PHẦN SỬA LỖI ===
        //        // So sánh t.Status.StatusName (là INT) 
        //        // với (int)TaskStatusModel.Done (cũng là INT, giá trị là 3)
        //        var completedTasks = project.Tasks.Count(t =>
        //            t.Status != null &&
        //            t.Status.StatusName == JIRA_NTB.Models.Enums.TaskStatusModel.Done); 
        //        // ============================

        //        return (int)((double)completedTasks / totalTasks * 100);
        //    }

        //    // Nếu chưa bắt đầu
        //    if (!project.StartDay.HasValue || project.StartDay > DateTime.Now)
        //        return 0;

        //    // Tính toán dựa trên thời gian nếu không có tasks
        //    if (project.StartDay.HasValue && project.EndDay.HasValue)
        //    {
        //        var totalDays = (project.EndDay.Value - project.StartDay.Value).TotalDays;
        //        if (totalDays <= 0) return 0; // Tránh chia cho 0

        //        var elapsedDays = (DateTime.Now - project.StartDay.Value).TotalDays;
        //        var progress = (int)((elapsedDays / totalDays) * 100);
        //        return Math.Min(Math.Max(progress, 0), 99); // Giới hạn từ 0-99%
        //    }

        //    return 0;
        //}
        private int CalculateProgress(ProjectModel project)
        {
            // Nếu chưa có task, trả về 0%
            if (project.Tasks == null || !project.Tasks.Any())
                return 0;

            var totalTasks = project.Tasks.Count;
            var completedTasks = project.Tasks.Count(t =>
                t.Status != null &&
                t.Status.StatusName == JIRA_NTB.Models.Enums.TaskStatusModel.Done);

            return (int)((double)completedTasks / totalTasks * 100);
        }
        //-----------------------------------------------
        // GET: /Project/GetLeaders
        [HttpGet]
        public async Task<IActionResult> GetLeaders()
        {
            // Lấy role id của "Leader" (tùy DB của bạn, Name có thể "LEADER" hoặc "Leader")
            var leaderRole = await _context.Roles.FirstOrDefaultAsync(r => r.NormalizedName == "LEADER" || r.Name == "Leader");
            if (leaderRole == null) return Json(new List<object>());

            var leaders = await _context.UserRoles
                .Where(ur => ur.RoleId == leaderRole.Id)
                .Join(_context.Users, ur => ur.UserId, u => u.Id, (ur, u) => new { u.Id, u.UserName, u.FullName, u.IdDepartment, u.Avt })
                .OrderBy(u => u.FullName)
                .ToListAsync();

            var result = leaders.Select(u => new { value = u.Id, text = (u.FullName ?? u.UserName) + (u.IdDepartment != null ? $" ({u.IdDepartment})" : ""), userName = u.UserName }).ToList();
            return Json(result);
        }

        // GET: /Project/GetUsersByLeader?leaderId=...
        [HttpGet]
        public async Task<IActionResult> GetUsersByLeader(string leaderId)
        {
            if (string.IsNullOrEmpty(leaderId)) return Json(new { success = false, users = new object[0] });

            var leader = await _context.Users.FirstOrDefaultAsync(u => u.Id == leaderId);
            if (leader == null) return Json(new { success = false, users = new object[0] });

            var users = await _context.Users
                .Where(u => u.IdDepartment == leader.IdDepartment)
                .OrderBy(u => u.FullName)
                .Select(u => new { u.Id, u.UserName, u.FullName, avatar = u.Avt })
                .ToListAsync();

            return Json(new { success = true, users });
        }

        // GET: /Project/SearchUsersByDepartment?leaderId=...&keyword=...
        [HttpGet]
        public async Task<IActionResult> SearchUsersByDepartment(string leaderId, string keyword)
        {
            if (string.IsNullOrEmpty(leaderId)) return Json(new { success = false, users = new object[0] });
            var leader = await _context.Users.FirstOrDefaultAsync(u => u.Id == leaderId);
            if (leader == null) return Json(new { success = false, users = new object[0] });

            var q = (keyword ?? string.Empty).Trim().ToLower();
            var users = await _context.Users
                .Where(u => u.IdDepartment == leader.IdDepartment &&
                       (u.UserName.ToLower().Contains(q) || (u.FullName != null && u.FullName.ToLower().Contains(q))))
                .OrderBy(u => u.FullName)
                .Select(u => new { u.Id, u.UserName, u.FullName, avatar = u.Avt })
                .Take(10)
                .ToListAsync();

            return Json(new { success = true, users });
        }
        //CRUD

        [HttpGet]
        public async Task<IActionResult> GetProjectForEdit(string id)
        {
            var project = await _context.Projects
                .Include(p => p.ProjectManagers) // Lấy danh sách thành viên
                .FirstOrDefaultAsync(p => p.IdProject == id);

            if (project == null)
            {
                return NotFound();
            }

            // Lấy danh sách usernames của thành viên
            var memberUsernames = await _context.ProjectManagers
                .Where(pm => pm.ProjectId == id)
                .Include(pm => pm.User)
                .Select(pm => pm.User.UserName)
                .ToListAsync();

            // Ghép lại thành chuỗi #user1 #user2 để fill vào textarea
            string membersInput = string.Join(" ", memberUsernames.Select(u => $"#{u}"));

            // Tạo một object để trả về (chỉ chứa các trường cần thiết)
            var projectData = new
            {
                idProject = project.IdProject,
                projectName = project.ProjectName,
                // Format ngày tháng sang yyyy-MM-dd cho <input type="date">
                startDay = project.StartDay?.ToString("yyyy-MM-dd"),
                endDay = project.EndDay?.ToString("yyyy-MM-dd"),
                userId = project.UserId, // Đây là Leader ID
                statusId = project.StatusId,
                note = project.Note,
                membersInput = membersInput
            };

            return Json(projectData);
        }

        // [POST] /Project/Edit
        // Xử lý việc Sửa dự án
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Edit(ProjectModel EditProject) // Model binding từ form Sửa
        {
            // Bỏ qua các validate không cần
            ModelState.Remove("Manager");
            ModelState.Remove("Status");
            // ... (bỏ các validate khác nếu cần)

            if (string.IsNullOrEmpty(EditProject.IdProject))
            {
                return BadRequest("Project ID is missing.");
            }

            if (!ModelState.IsValid)
            {
                // Nếu có lỗi, bạn nên trả về lỗi thay vì Redirect
                // (Phần này có thể làm phức tạp, tạm thời cứ Redirect)
                return RedirectToAction(nameof(Index));
            }

            try
            {
                var projectToUpdate = await _context.Projects
                    .Include(p => p.ProjectManagers) // Lấy các thành viên CŨ
                    .FirstOrDefaultAsync(p => p.IdProject == EditProject.IdProject);

                if (projectToUpdate == null)
                {
                    return NotFound();
                }

                // Cập nhật các trường cơ bản
                projectToUpdate.ProjectName = EditProject.ProjectName;
                projectToUpdate.StartDay = EditProject.StartDay;
                projectToUpdate.EndDay = EditProject.EndDay;
                projectToUpdate.UserId = EditProject.UserId; // Leader
                projectToUpdate.StatusId = EditProject.StatusId;
                projectToUpdate.Note = EditProject.Note;

                // --- Xử lý Thành viên (Quan trọng) ---
                // 1. Xóa tất cả thành viên CŨ
                _context.ProjectManagers.RemoveRange(projectToUpdate.ProjectManagers);

                // 2. Thêm lại thành viên MỚI từ MembersInput
                if (!string.IsNullOrWhiteSpace(EditProject.MembersInput))
                {
                    // DÙNG REGEX #... (Đã sửa từ payload của bạn)
                    var matches = Regex.Matches(EditProject.MembersInput, @"#([A-Za-z0-9_.-@]+)");
                    var usernames = matches
                        .Select(m => m.Groups[1].Value)
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToList();

                    if (usernames.Any())
                    {
                        var users = await _context.Users
                            .Where(u => usernames.Contains(u.UserName))
                            .ToListAsync();

                        foreach (var u in users)
                        {
                            _context.ProjectManagers.Add(new ProjectManagerModel
                            {
                                ProjectId = projectToUpdate.IdProject,
                                UserId = u.Id
                            });
                        }
                    }
                }

                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                // Ghi log lỗi
                Console.WriteLine("❌ Edit error: " + ex.Message);
            }

            return RedirectToAction(nameof(Index));
        }


        // [POST] /Project/Delete
        // Sửa lại action này để trả về JSON cho AJAX
        [HttpPost, ActionName("Delete")]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Delete(string id) // Lấy ID từ URL
        {
            if (string.IsNullOrEmpty(id))
            {
                return Json(new { success = false, message = "ID không hợp lệ." });
            }

            var project = await _context.Projects.FindAsync(id);
            if (project == null)
            {
                return Json(new { success = false, message = "Không tìm thấy dự án." });
            }

            try
            {
                var Status = await _statusRepository.GetByStatusNameAsync(TaskStatusModel.Deleted);
                project.StatusId = Status.StatusId; // Giả sử "status-deleted" là ID của trạng thái Đã Xóa
                _context.Projects.Update(project);
                await _context.SaveChangesAsync();

                return Json(new { success = true, message = "Dự án đã được chuyển vào thùng rác." });
            }
            catch (Exception ex)
            {
                // Lấy lỗi gốc từ bên trong (thường chứa thông tin từ SQL)
                var innerMessage = ex.InnerException != null ? ex.InnerException.Message : ex.Message;

                Console.WriteLine("❌ FULL ERROR: " + ex.ToString()); // Xem trong cửa sổ Output của Visual Studio

                return Json(new
                {
                    success = false,
                    // Trả về lỗi chi tiết để hiện lên alert
                    message = "Lỗi chi tiết: " + innerMessage
                });
            }
        }
        //-------------------updatet status by ajax------------------------
        [HttpPost]
        public async Task<IActionResult> UpdateStatus(string id, string statusId)
        {
            var project = await _context.Projects.FirstOrDefaultAsync(p => p.IdProject == id);
            if (project == null)
                return Json(new { success = false, message = "Không tìm thấy dự án." });

            // ✅ Gán đúng khóa Status
            project.StatusId = statusId;
            // Cập nhật CompletedDate nếu chuyển sang trạng thái "Done"
            if (statusId == "status-done") 
            {
                project.CompletedDate = DateTime.Now;
            }
            else
            {
                project.CompletedDate = null; // Xóa ngày hoàn thành nếu không phải "Done"
            }
                

            try
            {
                _context.Projects.Update(project);
                await _context.SaveChangesAsync();

                // ✅ Dùng switch theo chuỗi
                var (name, icon, badgeColor) = statusId switch
                {
                    "status-todo" => ("Lên kế hoạch", "clock", "bg-gray-100 text-gray-700"),
                    "status-inprogress" => ("Đang thực hiện", "loader", "bg-yellow-100 text-yellow-700"),
                    "status-done" => ("Hoàn thành", "check-circle", "bg-green-100 text-green-700"),
                    _ => ("Không xác định", "alert-circle", "bg-gray-100 text-gray-700")
                };

                return Json(new
                {
                    success = true,
                    statusName = name,
                    icon,
                    badgeColor
                });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = "Lỗi khi cập nhật: " + ex.Message });
            }
        }
        //chart data task by user in project detail

    }
}