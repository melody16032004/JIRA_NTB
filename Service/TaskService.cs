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
        private readonly IProjectRepository _projectRepository;
        private readonly IUserRepository _userRepo;

        public TaskService(ITaskRepository taskRepository, IStatusRepository statusRepository, IProjectRepository projectRepository, IUserRepository userRepo)
        {
            _taskRepository = taskRepository;
            _statusRepository = statusRepository;
            _projectRepository = projectRepository;
            _userRepo = userRepo;
        }

        public async Task<TaskBoardViewModel> GetTaskBoardAsync()
        {
            // ✅ Tách riêng logic cập nhật
            await _taskRepository.RefreshOverdueStatusAsync();

            var tasks = await _taskRepository.GetAllAsync();
            var projects = await _projectRepository.GetAllAsync();
            var statuses = await _statusRepository.GetAllAsync();
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
                    .Where(t => t.Overdue && t.Status?.StatusName != TaskStatusModel.Done && t.Status?.StatusName != TaskStatusModel.Deleted)
                    .ToViewModelList(),
                Projects = projects,
                Statuses = statuses

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
            // Check task có trễ hạn không
            bool isOverdue = task.Overdue;
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
            var validationResult = ValidateStatusTransition(task.Status?.StatusName, newStatus.StatusName, isOverdue);
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
            TaskStatusModel newStatus, bool isOverdue)
        {
            // Done không thể chuyển sang status khác (chỉ có thể undo)
            if (newStatus == TaskStatusModel.Deleted)
            {
                return (true, "OK");
            }
            if (newStatus != TaskStatusModel.Done && isOverdue)
            {
                return (false, "Task đã quá hạn chỉ có thể hoàn thành");
            }
            if (currentStatus == TaskStatusModel.Done)
            {
                return (false, "Task đã hoàn thành không thể thay đổi trạng thái");
            }
            return (true, "OK");
        }
        public async Task<IEnumerable<UserModel>> GetAllMemberProjectAsync(string projectId)
        {
            if (string.IsNullOrEmpty(projectId))
                return Enumerable.Empty<UserModel>();

            return await _userRepo.GetMembersByProjectAsync(projectId);
        }
        public async Task<(bool success, string message, string? taskId)> CreateTaskAsync(CreateTaskRequest request)
        {
            try
            {
                // Kiểm tra project tồn tại
                var project = await _projectRepository.GetByIdAsync(request.ProjectId);
                if (project == null)
                    return (false, "Dự án không tồn tại", null);

                // Kiểm tra assignee nếu có
                if (!string.IsNullOrEmpty(request.AssigneeId))
                {
                    var assignee = await _userRepo.GetUserById(request.AssigneeId);
                    if (assignee == null)
                        return (false, "Người thực hiện không tồn tại", null);
                }

                // Lấy status "TO DO"
                var todoStatus = await _statusRepository.GetByStatusNameAsync(TaskStatusModel.Todo);

                if (todoStatus == null)
                    return (false, "Không tìm thấy trạng thái mặc định", null);

                // Xử lý upload file
                string? fileNotePath = null;
                if (request.Files != null && request.Files.Count > 0)
                {
                    fileNotePath = await SaveFilesAsync(request.Files);
                }

                // Tạo task
                var newTask = new TaskItemModel
                {
                    IdTask = Guid.NewGuid().ToString(),
                    NameTask = request.NameTask.Trim(),
                    Note = request.Note?.Trim(),
                    Priority = request.Priority ?? "low",
                    StartDate = request.StartDate,
                    EndDate = request.EndDate,
                    Assignee_Id = request.AssigneeId ?? null,
                    ProjectId = request.ProjectId,
                    StatusId = todoStatus.StatusId,
                    FileNote = fileNotePath,
                    Overdue = false,
                    CompletedDate = null
                };

                await _taskRepository.AddAsync(newTask);

                return (true, "Tạo nhiệm vụ thành công", newTask.IdTask);
            }
            catch (Exception ex)
            {
                return (false, "Đã xảy ra lỗi khi tạo nhiệm vụ", null);
            }
        }
        private async Task<string> SaveFilesAsync(IFormFileCollection files)
        {
            var uploadPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "tasks");
            if (!Directory.Exists(uploadPath))
            {
                Directory.CreateDirectory(uploadPath);
            }

            string savedFilePath = string.Empty;
            foreach (var file in files)
            {
                var fileName = $"{Guid.NewGuid()}_{Path.GetFileName(file.FileName)}";
                var filePath = Path.Combine(uploadPath, fileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                savedFilePath = $"/uploads/tasks/{fileName}";
            }

            return savedFilePath;
        }
        public async Task<(bool success, string message)> UpdateTaskAsync(TaskViewModel model, List<IFormFile> files)
        {
            var task = await _taskRepository.GetByIdAsync(model.IdTask);
            if (task == null)
                return (false, "Không tìm thấy nhiệm vụ");

            // Cập nhật thông tin
            task.NameTask = model.NameTask;
            task.Note = model.Note;
            task.ProjectId = model.ProjectId;
            task.Assignee_Id = model.AssigneeId;
            task.Priority = model.Priority;
            task.StartDate = model.StartDate;
            task.EndDate = model.EndDate;

            // Upload file mới nếu có
            if (files != null && files.Count > 0)
            {
                // Xóa file cũ nếu có
                if (!string.IsNullOrEmpty(task.FileNote))
                {
                    var oldPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", task.FileNote.TrimStart('/'));
                    if (System.IO.File.Exists(oldPath))
                        System.IO.File.Delete(oldPath);
                }

                // Upload file mới
                var uploadFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "tasks");
                if (!Directory.Exists(uploadFolder))
                    Directory.CreateDirectory(uploadFolder);

                var file = files[0];
                var fileName = $"{Guid.NewGuid()}_{file.FileName}";
                var filePath = Path.Combine(uploadFolder, fileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                task.FileNote = $"/uploads/tasks/{fileName}";
            }

            await _taskRepository.UpdateAsync(task);
            return (true, "Cập nhật nhiệm vụ thành công!");
        }


        public async Task<(bool success, string message)> DeleteTaskAsync(string taskId)
        {
            var task = await _taskRepository.GetByIdAsync(taskId);
            if (task == null)
                return (false, "Không tìm thấy nhiệm vụ");

            // Xóa file nếu có
            if (!string.IsNullOrEmpty(task.FileNote))
            {
                var filePath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", task.FileNote.TrimStart('/'));
                if (System.IO.File.Exists(filePath))
                    System.IO.File.Delete(filePath);
            }

            await _taskRepository.DeleteAsync(taskId);
            return (true, "Xóa nhiệm vụ thành công!");
        }
    }
}
