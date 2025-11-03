using JIRA_NTB.Models;
using JIRA_NTB.Models.Enums;
using JIRA_NTB.Repository;
using JIRA_NTB.ViewModels;
using Microsoft.EntityFrameworkCore;

namespace JIRA_NTB.Service
{
    public class TaskService : ITaskService
    {
        private readonly ITaskRepository _taskRepository;
        private readonly IStatusRepository _statusRepository;

        public TaskService(ITaskRepository taskRepository, IStatusRepository statusRepository)
        {
            _taskRepository = taskRepository;
            _statusRepository = statusRepository;
        }

        public async Task<TaskBoardViewModel> GetTaskBoardAsync()
        {
            // ✅ Tách riêng logic cập nhật
            await _taskRepository.RefreshOverdueStatusAsync();

            var tasks = await _taskRepository.GetAllAsync();

            var viewModel = new TaskBoardViewModel
            {
                TodoTasks = tasks
                    .Where(t => t.Status?.StatusName == TaskStatusModel.Todo && !t.Overdue)
                    .ToViewModelList(),

                InProgressTasks = tasks
                    .Where(t => t.Status?.StatusName == TaskStatusModel.InProgress && !t.Overdue)
                    .ToViewModelList(),

                DoneTasks = tasks
                    .Where(t => t.Status?.StatusName == TaskStatusModel.Done)
                    .ToViewModelList(),

                OverdueTasks = tasks
                    .Where(t => t.Overdue && t.Status?.StatusName != TaskStatusModel.Done)
                    .ToViewModelList()
            };

            return viewModel;
        }
        public async Task<TaskStatusChangeResult> UpdateTaskStatusAsync(string taskId, string newStatusId)
        {
            var task = await _taskRepository.GetByIdAsync(taskId);

            if (task == null)
            {
                return new TaskStatusChangeResult
                {
                    Success = false,
                    Message = "Task không tồn tại"
                };
            }

            // Lấy thông tin status cũ và mới
            var previousStatusId = task.StatusId;
            var previousStatus = task.Status;
            var newStatus = await _statusRepository.GetByIdAsync(newStatusId);

            if (newStatus == null)
            {
                return new TaskStatusChangeResult
                {
                    Success = false,
                    Message = "Status mới không tồn tại"
                };
            }

            // Validate transition rules
            var validationResult = ValidateStatusTransition(task.Status?.StatusName, newStatus.StatusName);
            if (!validationResult.isValid)
            {
                return new TaskStatusChangeResult
                {
                    Success = false,
                    Message = validationResult.message
                };
            }

            // Update status - CHỈ CẬP NHẬT StatusId
            task.StatusId = newStatusId;

            // Nếu chuyển sang Done, set CompletedDate
            if (newStatus.StatusName == TaskStatusModel.Done)
            {
                task.CompletedDate = DateTime.Now;
            }
            else
            {
                task.CompletedDate = null;
            }

            await _taskRepository.UpdateAsync(task);

            return new TaskStatusChangeResult
            {
                Success = true,
                Message = "Cập nhật trạng thái thành công",
                TaskId = taskId,
                PreviousStatusId = previousStatusId,
                NewStatusId = newStatusId,
                PreviousStatusName = previousStatus?.StatusName.ToString(),
                NewStatusName = newStatus.StatusName.ToString()
            };
        }

        public async Task<TaskStatusChangeResult> UndoTaskStatusAsync(string taskId, string previousStatusId)
        {
            var task = await _taskRepository.GetByIdAsync(taskId);

            if (task == null)
            {
                return new TaskStatusChangeResult
                {
                    Success = false,
                    Message = "Task không tồn tại"
                };
            }

            var previousStatus = await _statusRepository.GetByIdAsync(previousStatusId);

            if (previousStatus == null)
            {
                return new TaskStatusChangeResult
                {
                    Success = false,
                    Message = "Status trước đó không tồn tại"
                };
            }

            var currentStatusId = task.StatusId;

            // Restore previous status - CHỈ CẬP NHẬT StatusId
            task.StatusId = previousStatusId;
            task.CompletedDate = null; // Clear completed date when undo

            await _taskRepository.UpdateAsync(task);

            return new TaskStatusChangeResult
            {
                Success = true,
                Message = "Hoàn tác thành công",
                TaskId = taskId,
                PreviousStatusId = currentStatusId,
                NewStatusId = previousStatusId,
                NewStatusName = previousStatus.StatusName.ToString()
            };
        }

        private (bool isValid, string message) ValidateStatusTransition(
            TaskStatusModel? currentStatus,
            TaskStatusModel newStatus)
        {
            // Done không thể chuyển sang status khác (chỉ có thể undo)
            if (currentStatus == TaskStatusModel.Done)
            {
                return (false, "Task đã hoàn thành không thể thay đổi trạng thái");
            }

            return (true, "OK");
        }
    }
}
