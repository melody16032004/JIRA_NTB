using AutoMapper;
using JIRA_NTB.Models;
using JIRA_NTB.Models.Enums;
using JIRA_NTB.Repository;
using JIRA_NTB.Service;
using JIRA_NTB.ViewModels;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JIRA_NTB.Controllers
{
    public class TaskController : Controller
    {
        private readonly ITaskService taskService;

        public TaskController(ITaskService taskService)
        {
            this.taskService = taskService;
        }
        public async Task<IActionResult> Index()
        {
            var viewModel = await taskService.GetTaskBoardAsync();
            return View(viewModel);
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
                        newStatusName = result.NewStatusName
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

            var result = await taskService.UndoTaskStatusAsync(request.TaskId, request.PreviousStatusId);

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
            var taskBoard = await taskService.GetTaskBoardAsync();
            var task = taskBoard.TodoTasks
                .Concat(taskBoard.InProgressTasks)
                .Concat(taskBoard.DoneTasks)
                .FirstOrDefault(t => t.IdTask == taskId);

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
                task.Assignee?.Id
            });
        }

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
        [HttpPost]
        public async Task<IActionResult> UpdateTask(TaskViewModel model, List<IFormFile> Files)
        {
            var result = await taskService.UpdateTaskAsync(model, Files);
            return Json(new { success = result.success, message = result.message });
        }

        [HttpPost]
        public async Task<IActionResult> DeleteTask(string taskId)
        {
            var result = await taskService.UpdateTaskStatusAsync(taskId, "status-deleted");
            return Json(new
            {
                success = result.Success,
                message = result.Message,
                previousStatusId = result.PreviousStatusId // để client dùng undo
            });
        }
    }
}
