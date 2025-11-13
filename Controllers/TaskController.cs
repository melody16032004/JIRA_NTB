using AutoMapper;
using JIRA_NTB.Models;
using JIRA_NTB.Models.Enums;
using JIRA_NTB.Repository;
using JIRA_NTB.Services;
using JIRA_NTB.ViewModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JIRA_NTB.Controllers
{
    [Authorize]
    public class TaskController : Controller
    {
        private readonly ITaskService taskService;
        private readonly UserManager<UserModel> _userManager;
        private readonly IStatusRepository statusRepository;

        public TaskController(ITaskService taskService, UserManager<UserModel> userManager, IStatusRepository statusRepository)
        {
            this.taskService = taskService;
            _userManager = userManager;
            this.statusRepository = statusRepository;
        }
        public async Task<IActionResult> Index(string? projectId = null)
        {
            var user = await _userManager.GetUserAsync(User);
            var roles = await _userManager.GetRolesAsync(user);
            var viewModel = await taskService.GetTaskBoardAsync(user, roles, projectId);
            ViewBag.SelectedProjectId = projectId; // để giữ lại lựa chọn
            return View(viewModel);
        }
        [HttpGet]
        public async Task<IActionResult> GetMoreTasks(string statusId, int page = 1, int pageSize = 10, string? projectId = null)
        {
            var user = await _userManager.GetUserAsync(User);
            var roles = await _userManager.GetRolesAsync(user);

            var tasks = await taskService.GetTasksByStatusAsync(user, roles, statusId, page, pageSize, projectId);

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
            if(request.NewStatusId == "False")
            {
                return Json(new
                {
                    success = false,
                    message = "Không thể cập nhật trạng thái trễ hạn"
                });
            }
            var result = await taskService.UpdateTaskStatusAsync(request.TaskId, request.NewStatusId);

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
                        previousCompletedDate = result.PreviousCompletedDate
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

            var result = await taskService.UndoTaskStatusAsync(
                request.TaskId,
                request.PreviousStatusId,
                request.previousCompletedDate);

            if (result.Success)
            {
                return Json(new
                {
                    success = true,
                    message = result.Message
                });
            }

            return Json(new
            {
                success = false,
                message = result.Message
            });
        }
        [HttpGet]
        public async Task<IActionResult> GetMembersByProject(string projectId)
        {
            if (string.IsNullOrEmpty(projectId))
                return BadRequest("Thiếu projectId.");

            var members = await taskService.GetAllMemberProjectAsync(projectId);

            return Json(members.Select(m => new
            {
                userId = m.Id,
                userName = m.UserName
            }));
        }
        [HttpGet]
        public async Task<IActionResult> GetTaskById(string taskId)
        {
            var user = await _userManager.GetUserAsync(User);
            var roles = await _userManager.GetRolesAsync(user);

            var task = await taskService.GetTaskByIdAsync(taskId, user, roles);

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
            var result = await taskService.UpdateTaskStatusAsync(taskId, null);
            return Json(new
            {
                success = result.Success,
                message = result.Message,
                previousStatusId = result.PreviousStatusId // để client dùng undo
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
            var user = await _userManager.GetUserAsync(User);
            var roles = await _userManager.GetRolesAsync(user);
            if (string.IsNullOrEmpty(projectId))
                return BadRequest("ProjectId không hợp lệ.");

            var tasks = await taskService.GetTasksByProjectIdAsync(projectId, user, roles);

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
    }
}
