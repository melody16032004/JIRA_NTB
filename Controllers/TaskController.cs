using AutoMapper;
using JIRA_NTB.Models.Enums;
using JIRA_NTB.Repository;
using JIRA_NTB.Service;
using JIRA_NTB.ViewModels;
using Microsoft.AspNetCore.Mvc;

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
    }
}
