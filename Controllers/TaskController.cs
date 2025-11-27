using AutoMapper;
using JIRA_NTB.Data;
using JIRA_NTB.Extensions;
using JIRA_NTB.Models;
using JIRA_NTB.Models.Enums;
using JIRA_NTB.Repository;
using JIRA_NTB.Services;
using JIRA_NTB.ViewModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

namespace JIRA_NTB.Controllers
{
    //[Authorize]
    public class TaskController : Controller
    {
        private readonly ITaskService taskService;
        private readonly IStatusRepository statusRepository;
        private readonly ITaskSearchService _taskSearchService;
        private readonly AppDbContext _dbContext;
        public TaskController(ITaskService taskService, IStatusRepository statusRepository, ITaskSearchService taskSearchService, AppDbContext dbContext)
        {
            this.taskService = taskService;
            this.statusRepository = statusRepository;
            _taskSearchService = taskSearchService;
            _dbContext = dbContext;
        }
        public async Task<IActionResult> Index(string? projectId = null, string? taskId = null, string? keyword = null)
        {
            string userId = User.GetUserId();
            List<string> roles = User.GetUserRoles();
            var viewModel = await taskService.GetTaskBoardAsync(userId, roles, projectId, taskId);
            ViewBag.SelectedProjectId = projectId; // để giữ lại lựa chọn
            ViewBag.SearchKeyword = keyword;
            return View(viewModel);
        }
        [HttpGet]
        public async Task<IActionResult> Search(string keyword, string? projectId)
        {
            if (string.IsNullOrWhiteSpace(keyword))
                return RedirectToAction("Index", new { projectId });

            var task = await _taskSearchService.FindByFullNameAsync(keyword, projectId);

            if (task == null)
            {
                TempData["SearchMessage"] = "Không tìm thấy nhiệm vụ";
                return RedirectToAction("Index", new { projectId });
            }

            // ⭐ Redirect về Index nhưng truyền đúng TaskId
            return RedirectToAction("Index", new { projectId, taskId = task.Id, keyword = keyword });
        }
        [HttpGet]
        public async Task<IActionResult> GetMoreTasks(string statusId, int page = 1, int pageSize = 10, string? projectId = null)
        {
            string userId = User.GetUserId();
            List<string> roles = User.GetUserRoles();
            var tasks = await taskService.GetTasksByStatusAsync(userId, roles, statusId, page, pageSize, projectId);

            return PartialView("_TaskCardList", tasks);
        }
        [HttpPost]
        public async Task<IActionResult> UpdateStatus([FromBody] UpdateStatusRequest request)
        {
            if (string.IsNullOrEmpty(request.TaskId) || string.IsNullOrEmpty(request.NewStatusId))
            {
                return Json(new
                {
                    success = false,
                    message = "Dữ liệu không hợp lệ"
                });
            }

            if (request.NewStatusId == "False")
            {
                return Json(new
                {
                    success = false,
                    message = "Không thể cập nhật trạng thái trễ hạn"
                });
            }
            string userId = User.GetUserId();
            List<string> roles = User.GetUserRoles();

            var result = await taskService.UpdateTaskStatusAsync(
                request.TaskId,
                request.NewStatusId,
                userId,
                roles
            );

            if (result.Success)
            {
                return Json(new
                {
                    success = true,
                    message = result.Message,
                    data = new
                    {
                        taskId = result.TaskId,
                        previousStatusId = result.PreviousStatusId,
                        newStatusId = result.NewStatusId,
                        previousStatusName = result.PreviousStatusName,
                        newStatusName = result.NewStatusName,
                        previousCompletedDate = result.PreviousCompletedDate,
                        // ✅ Thêm total count
                        sourceTotalCount = result.SourceTotalCount,
                        targetTotalCount = result.TargetTotalCount
                    }
                });
            }

            return Json(new
            {
                success = false,
                message = result.Message
            });
        }

        [HttpPost]
        public async Task<IActionResult> UndoStatus([FromBody] UndoStatusRequest request)
        {
            if (string.IsNullOrEmpty(request.TaskId) || string.IsNullOrEmpty(request.PreviousStatusId))
            {
                return Json(new
                {
                    success = false,
                    message = "Dữ liệu không hợp lệ"
                });
            }
            string userId = User.GetUserId();
            List<string> roles = User.GetUserRoles();

            var result = await taskService.UndoTaskStatusAsync(
                request.TaskId,
                request.PreviousStatusId,
                request.previousCompletedDate,
                userId,
                roles
            );

            if (result.Success)
            {
                return Json(new
                {
                    success = true,
                    message = result.Message,
                    data = new
                    {
                        // ✅ Thêm total count cho undo
                        sourceTotalCount = result.SourceTotalCount,
                        targetTotalCount = result.TargetTotalCount
                    }
                });
            }

            return Json(new
            {
                success = false,
                message = result.Message
            });
        }
        [HttpGet]
        public async Task<IActionResult> GetMembersByProject(string projectId, string? userId)
        {
            if (string.IsNullOrEmpty(projectId))
                return BadRequest("Thiếu projectId.");

            var members = await taskService.GetAllMemberProjectAsync(projectId, userId);

            return Json(members.Select(m => new
            {
                userId = m.Id,
                userName = m.UserName
            }));
        }
        [HttpGet]
        public async Task<IActionResult> GetTaskById(string taskId)
        {
            string userId = User.GetUserId();
            List<string> roles = User.GetUserRoles();

            var task = await taskService.GetTaskByIdAsync(taskId, userId, roles);

            if (task == null)
                return NotFound(new { success = false, message = "Không tìm thấy nhiệm vụ" });

            return Json(new
            {
                task.IdTask,
                task.NameTask,
                task.Note,
                task.Priority,
                task.StartDate,
                task.EndDate,
                task.ProjectId,
                AssigneeId = task.Assignee?.Id,
                AssigneeName = task.Assignee?.FullName
            });
        }
        [Authorize(Roles = "ADMIN,LEADER")]
        [HttpPost]
        public async Task<IActionResult> CreateTask([FromForm] CreateTaskRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new { success = false, message = "Dữ liệu không hợp lệ", errors = ModelState });
            }

            var result = await taskService.CreateTaskAsync(request);

            if (!result.success)
                return BadRequest(new { success = false, message = result.message });

            return Ok(new
            {
                success = true,
                message = result.message,
                taskId = result.taskId
            });
        }
        [Authorize(Roles = "ADMIN,LEADER")]
        [HttpPost]
        public async Task<IActionResult> UpdateTask(TaskViewModel model, List<IFormFile> Files)
        {
            var result = await taskService.UpdateTaskAsync(model, Files);
            return Json(new { success = result.success, message = result.message });
        }
        [Authorize(Roles = "ADMIN,LEADER")]
        [HttpPost]
        public async Task<IActionResult> DeleteTask(string taskId)
        {
            string userId = User.GetUserId();
            List<string> roles = User.GetUserRoles();

            var result = await taskService.DeleteTaskAsync(taskId, userId, roles);

            if (result.Success)
            {
                return Json(new
                {
                    success = true,
                    message = result.Message,
                    data = new
                    {
                        taskId = result.TaskId,
                        previousStatusId = result.PreviousStatusId,
                        previousCompletedDate = result.PreviousCompletedDate,
                        // ✅ Chỉ cần sourceTotalCount (column bị xóa task)
                        sourceTotalCount = result.SourceTotalCount
                    }
                });
            }

            return Json(new
            {
                success = false,
                message = result.Message
            });
        }
        [Authorize(Roles = "ADMIN,LEADER")]
        [HttpPost]
        public async Task<IActionResult> RestoreTask([FromBody] RestoreTaskRequest request)
        {
            if (string.IsNullOrEmpty(request.TaskId) || string.IsNullOrEmpty(request.PreviousStatusId))
            {
                return Json(new
                {
                    success = false,
                    message = "Dữ liệu không hợp lệ"
                });
            }

            string userId = User.GetUserId();
            List<string> roles = User.GetUserRoles();

            var result = await taskService.RestoreTaskAsync(
                request.TaskId,
                request.PreviousStatusId,
                request.PreviousCompletedDate,
                userId,
                roles
            );

            if (result.Success)
            {
                return Json(new
                {
                    success = true,
                    message = result.Message,
                    data = new
                    {
                        taskId = result.TaskId,
                        // ✅ Chỉ cần targetTotalCount (column được restore)
                        targetTotalCount = result.TargetTotalCount
                    }
                });
            }

            return Json(new
            {
                success = false,
                message = result.Message
            });
        }

        //[HttpGet]
        //public async Task<IActionResult> GetTasksByProjectId(string projectId)
        //{
        //    if (string.IsNullOrEmpty(projectId))
        //        return BadRequest("ProjectId không hợp lệ.");

        //    var tasks = await taskService.GetTasksByProjectIdAsync(projectId);
        //    return Ok(tasks);
        //}
        [HttpGet]
        public async Task<IActionResult> GetTaskCardsByProjectId(string projectId)
        {
            string userId = User.GetUserId();
            List<string> roles = User.GetUserRoles();
            if (string.IsNullOrEmpty(projectId))
                return BadRequest("ProjectId không hợp lệ.");

            var tasks = await taskService.GetTasksByProjectIdAsync(projectId, userId, roles);

            // Hàm tính logic hiển thị
            var mapTasks = (IEnumerable<TaskItemModel> taskList) => taskList.Select(t =>
            {
                bool isCompleted = t.Status?.StatusName == TaskStatusModel.Done;
                bool isOverdue = t.EndDate.HasValue && t.EndDate.Value < DateTime.Now && !isCompleted;
                bool isDoneLate = t.EndDate.HasValue && t.CompletedDate.HasValue && t.CompletedDate.Value > t.EndDate.Value;
                bool isDoneOnTime = t.EndDate.HasValue && t.CompletedDate.HasValue && t.CompletedDate.Value <= t.EndDate.Value;
                int daysRemaining = t.EndDate.HasValue ? (int)Math.Ceiling((t.EndDate.Value - DateTime.Now).TotalDays) : 0;
                int daysLate = isDoneLate ? (t.CompletedDate!.Value - t.EndDate!.Value).Days : 0;

                return new
                {
                    idTask = t.IdTask,
                    nameTask = t.NameTask,
                    priority = t.Priority,
                    note = t.Note,
                    startDate = t.StartDate,
                    endDate = t.EndDate,
                    completedDate = t.CompletedDate,
                    isCompleted,
                    isOverdue,
                    isDoneLate,
                    isDoneOnTime,
                    daysRemaining,
                    daysLate,
                    fileNote = t.FileNote,
                    assignee = t.Assignee != null ? new
                    {
                        id = t.Assignee.Id,
                        fullName = t.Assignee.FullName
                    } : null,
                    project = t.Project != null ? new
                    {
                        projectId = t.Project.IdProject,
                        projectName = t.Project.ProjectName
                    } : null,
                    status = t.Status != null ? new
                    {
                        statusId = t.Status.StatusId,
                        statusName = t.Status.StatusName
                    } : null
                };
            });

            // 🗂 Phân loại nhiệm vụ
            var result = new
            {
                todoTasks = mapTasks(tasks.Where(t => t.Status?.StatusName == TaskStatusModel.Todo && !t.Overdue)),
                inProgressTasks = mapTasks(tasks.Where(t => t.Status?.StatusName == TaskStatusModel.InProgress && !t.Overdue)),
                doneTasks = mapTasks(tasks.Where(t => t.Status?.StatusName == TaskStatusModel.Done)),
                overdueTasks = mapTasks(tasks.Where(t =>
                    t.EndDate.HasValue &&
                    t.EndDate.Value < DateTime.Now &&
                    (t.Status?.StatusName != TaskStatusModel.Done &&
                     t.Status?.StatusName != TaskStatusModel.Deleted)))
            };

            return Json(result);
        }
        [Authorize(Roles = "ADMIN,LEADER")]
        public async Task<IActionResult> ReassignUser([FromBody] ReassignTaskDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest("Dữ liệu không hợp lệ.");

            string userId = User.GetUserId();

            string reassignedById = userId;

            var result = await taskService.ReassignTaskAsync(dto, reassignedById);

            if (!result)
                return NotFound("Task không tồn tại.");

            return Ok(new { message = "Thay người thành công" });
        }
        [HttpGet]
        public async Task<IActionResult> CheckSchedule(string userId, DateTime startDate, DateTime endDate)
        {
            var result = await taskService.CheckUserScheduleAsync(userId, startDate, endDate);
            return Json(result);
        }
        public async Task<IActionResult> GetLog(int page = 1, int pageSize = 30)
        {
            string userId = User.GetUserId();
            List<string> roles = User.GetUserRoles();

            PagedResult<LogStatusDTO> logs =
                await taskService.GetLogsAsync(userId, roles, page, pageSize);

            return Ok(logs);
        }
        [HttpPost]
        public async Task<IActionResult> IndexTask([FromBody] TaskEntity task)
        {
            await _taskSearchService.IndexTaskAsync(task);
            return Ok(new { message = "Task indexed successfully", taskId = task.Id });
        }

        // Endpoint để index NHIỀU tasks cùng lúc
        [HttpPost]
        public async Task<IActionResult> IndexTasks([FromBody] List<TaskEntity> tasks)
        {
            await _taskSearchService.IndexTasksAsync(tasks);
            return Ok(new { message = $"{tasks.Count} tasks indexed successfully" });
        }
        [HttpGet]
        public async Task<IActionResult> SmartSuggest([FromQuery] string keyword, [FromQuery] string? projectId)
        {
            var suggestions = await _taskSearchService.SmartSuggestAsync(keyword, projectId);
            return Ok(suggestions);
        }
        [HttpPost]
        public async Task<IActionResult> RebuildIndex()
        {
            // Lấy tất cả task từ database
            var tasks = await _dbContext.Tasks
            .Select(t => new TaskEntity
            {
                Id = t.IdTask,
                Name = t.NameTask,
                ProjectId = t.ProjectId
            })
            .ToListAsync();

            // Index tất cả vào Lucene
            await _taskSearchService.IndexTasksAsync(tasks);

            return Ok(new { message = $"Indexed {tasks.Count} tasks" });
        }
    }
}
