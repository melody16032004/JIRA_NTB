using JIRA_NTB.Models;
using JIRA_NTB.Models.Enums;
using JIRA_NTB.Repository;
using JIRA_NTB.ViewModels;
using Microsoft.EntityFrameworkCore;
using Polly;

namespace JIRA_NTB.Services
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

        public async Task<TaskBoardViewModel> GetTaskBoardAsync(UserModel user, IList<string> roles, string? projectId = null)
        {
            // ✅ Tách riêng logic cập nhật
            await _taskRepository.RefreshOverdueStatusAsync();

            var tasks = await _taskRepository.GetAllFilteredAsync(user, roles);
            if (!string.IsNullOrEmpty(projectId))
            {
                tasks = tasks.Where(t => t.ProjectId == projectId).ToList();
            }
            var projects = await _projectRepository.GetAllFilteredAsync(user, roles);
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
        public async Task<List<TaskViewModel>> GetTasksByStatusAsync(
      UserModel user,
      IList<string> roles,
      string statusId,
      int page,
      int pageSize, string? projectId = null)
        {
            var tasks = await _taskRepository.GetTasksByStatusPagedAsync(
                user,
                roles,
                statusId,
                page,
                pageSize, projectId);

            return tasks.ToViewModelList();
        }
        public async Task<TaskItemModel?> GetTaskByIdAsync(string taskId, UserModel user, IList<string> roles)
        {
            return await _taskRepository.GetByIdFilteredAsync(taskId, user, roles);
        }
        public async Task<TaskStatusChangeResult> UpdateTaskStatusAsync(
    string taskId,
    string newStatusId,
    UserModel user,
    IList<string> roles)
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

            bool isOverdue = task.Overdue;
            var previousStatusId = task.StatusId;
            var previousStatus = task.Status;
            DateTime? previousCompletedDate = null;
            Status newStatus = null;

            if (newStatusId != null)
            {
                newStatus = await _statusRepository.GetByIdAsync(newStatusId);
                if (newStatus == null)
                {
                    return new TaskStatusChangeResult
                    {
                        Success = false,
                        Message = "Status mới không tồn tại"
                    };
                }

                // Update FK
                task.StatusId = newStatusId;

                // Set CompletedDate correctly
                if (newStatus.StatusName == TaskStatusModel.Done)
                {
                    task.CompletedDate = DateTime.Now;
                }
                else
                {
                    if (previousStatus?.StatusName == TaskStatusModel.Done)
                    {
                        previousCompletedDate = task.CompletedDate;
                        task.CompletedDate = null;
                    }
                }
            }
            else
            {
                var deleted = await _statusRepository.GetByStatusNameAsync(TaskStatusModel.Deleted);
                if (deleted == null)
                {
                    return new TaskStatusChangeResult
                    {
                        Success = false,
                        Message = "Không tìm thấy trạng thái Deleted"
                    };
                }

                task.StatusId = deleted.StatusId;
                newStatus = deleted;
            }

            await _taskRepository.UpdateAsync(task);
            var log = new LogStatusUpdate
            {
                IdTask = task.IdTask,
                IdUserUpdate = user.Id,
                PreviousStatusId = previousStatusId,
                NewStatusId = task.StatusId,
            };
          
            await _taskRepository.AddStatusLog(log);
                
            var sourceTotalCount = await _taskRepository.GetTaskCountByStatusAsync(
                 user,
                roles,
                previousStatusId,
                null // projectId - lấy từ session nếu cần filter theo project
            );

            var targetTotalCount = await _taskRepository.GetTaskCountByStatusAsync(
                user,
                roles,
                newStatusId,
                null
            );

            return new TaskStatusChangeResult
            {
                Success = true,
                Message = "Cập nhật trạng thái thành công",
                TaskId = taskId,
                PreviousStatusId = previousStatusId,
                NewStatusId = task.StatusId,
                PreviousStatusName = previousStatus?.StatusName.ToString(),
                NewStatusName = newStatus.StatusName.ToString(),
                PreviousCompletedDate = previousCompletedDate,
                // ✅ Trả về total count
                SourceTotalCount = sourceTotalCount,
                TargetTotalCount = targetTotalCount
            };
        }

        public async Task<TaskStatusChangeResult> UndoTaskStatusAsync(
    string taskId,
    string previousStatusId,
    DateTime? previousCompletedDate,
    UserModel user,
    IList<string> roles)
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

            // Restore previous status
            task.StatusId = previousStatusId;
            task.CompletedDate = previousCompletedDate;

            await _taskRepository.UpdateAsync(task);

            // ✅ Lấy total count sau khi undo
            var sourceTotalCount = await _taskRepository.GetTaskCountByStatusAsync(
                user,
                roles,
                currentStatusId,
                null
            );

            var targetTotalCount = await _taskRepository.GetTaskCountByStatusAsync(
                user,
                roles,
                previousStatusId,
                null
            );

            return new TaskStatusChangeResult
            {
                Success = true,
                Message = "Hoàn tác thành công",
                TaskId = taskId,
                PreviousStatusId = currentStatusId,
                NewStatusId = previousStatusId,
                NewStatusName = previousStatus.StatusName.ToString(),
                // ✅ Trả về total count
                SourceTotalCount = sourceTotalCount,
                TargetTotalCount = targetTotalCount
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
        public async Task<IEnumerable<UserModel>> GetAllMemberProjectAsync(string projectId, string? userId)
        {
            if (string.IsNullOrEmpty(projectId))
                return Enumerable.Empty<UserModel>();

            return await _userRepo.GetMembersByProjectAsync(projectId, userId);
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
                    if (File.Exists(oldPath))
                        File.Delete(oldPath);
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
        public async Task<TaskStatusChangeResult> DeleteTaskAsync(
            string taskId,
            UserModel user,
            IList<string> roles)
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

            var previousStatusId = task.StatusId;
            var previousStatus = task.Status;
            DateTime? previousCompletedDate = null;

            // Lưu CompletedDate nếu task đang ở trạng thái Done
            if (previousStatus?.StatusName == TaskStatusModel.Done)
            {
                previousCompletedDate = task.CompletedDate;
            }

            // ✅ LẤY COUNT TRƯỚC KHI UPDATE
            var sourceTotalCountBeforeDelete = await _taskRepository.GetTaskCountByStatusAsync(
                user,
                roles,
                previousStatusId,
                null
            );

            var deletedStatus = await _statusRepository.GetByStatusNameAsync(TaskStatusModel.Deleted);
            if (deletedStatus == null)
            {
                return new TaskStatusChangeResult
                {
                    Success = false,
                    Message = "Không tìm thấy trạng thái Deleted"
                };
            }

            // Chuyển sang Deleted
            task.StatusId = deletedStatus.StatusId;
            task.CompletedDate = null;

            await _taskRepository.UpdateAsync(task);
            var log = new LogStatusUpdate
            {
                IdTask = task.IdTask,
                IdUserUpdate = user.Id,
                PreviousStatusId = previousStatusId,
                NewStatusId = task.StatusId,
            };

            await _taskRepository.AddStatusLog(log);
            // ✅ Count sau khi xóa = count trước - 1
            var sourceTotalCount = sourceTotalCountBeforeDelete - 1;

            return new TaskStatusChangeResult
            {
                Success = true,
                Message = "Đã chuyển task vào thùng rác",
                TaskId = taskId,
                PreviousStatusId = previousStatusId,
                NewStatusId = deletedStatus.StatusId,
                PreviousStatusName = previousStatus?.StatusName.ToString(),
                NewStatusName = TaskStatusModel.Deleted.ToString(),
                PreviousCompletedDate = previousCompletedDate,
                SourceTotalCount = sourceTotalCount,
                TargetTotalCount = 0
            };
        }
        /// <summary>
        /// ✅ Restore task từ Deleted (để undo delete)
        /// </summary>
        public async Task<TaskStatusChangeResult> RestoreTaskAsync(
            string taskId,
            string previousStatusId,
            DateTime? previousCompletedDate,
            UserModel user,
            IList<string> roles)
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

            // Restore về status cũ
            task.StatusId = previousStatusId;
            task.CompletedDate = previousCompletedDate;

            await _taskRepository.UpdateAsync(task);

            // ✅ Lấy count của column được restore
            var targetTotalCount = await _taskRepository.GetTaskCountByStatusAsync(
                user,
                roles,
                previousStatusId,
                null
            );

            return new TaskStatusChangeResult
            {
                Success = true,
                Message = "Đã khôi phục task",
                TaskId = taskId,
                PreviousStatusId = previousStatusId,
                NewStatusId = previousStatusId,
                NewStatusName = previousStatus.StatusName.ToString(),
                // ✅ Chỉ trả về target count (column được restore)
                SourceTotalCount = 0,
                TargetTotalCount = targetTotalCount
            };
        }

        public async Task<List<TaskItemModel>> GetTasksByProjectIdAsync(string projectId, UserModel user, IList<string> roles)
        {
            if (string.IsNullOrEmpty(projectId))
                return new List<TaskItemModel>();

            return await _taskRepository.GetByProjectIdAsync(projectId, user, roles);
        }
        public async Task<int> GetTotalTaskCountByStatusAsync(
        UserModel user,
        IList<string> roles,
        string statusId,
        string? projectId = null)
        {
            return await _taskRepository.GetTaskCountByStatusAsync(
                user,
                roles,
                statusId,
                projectId);
        }
        public async Task<bool> ReassignTaskAsync(ReassignTaskDto dto, string reassignedById)
        {
            var task = await _taskRepository.GetByIdAsync(dto.TaskId);
            if (task == null)
                return false;

            string oldUserId = task.Assignee_Id;

            if (oldUserId == dto.NewUserId)
                throw new Exception("Người mới phải khác người cũ.");

            // 🔹 Tạo log thay đổi
            var log = new LogTaskModel
            {
                TaskId = dto.TaskId,
                Progress = dto.Progress,
                Reason = dto.Reason,
                OldUserId = oldUserId,
                ReassignedById = reassignedById
            };

            await _taskRepository.AddLogAsync(log);

            // 🔹 Cập nhật Task sang người mới
            task.Assignee_Id = dto.NewUserId;

            await _taskRepository.SaveChangesAsync();

            return true;
        }
        public async Task<UserScheduleResult> CheckUserScheduleAsync(
    string userId,
    DateTime newStart,
    DateTime newEnd)
        {
            var tasks = await _taskRepository.GetSchedule(userId);

            var merged = new List<(DateTime Start, DateTime End)>();

            foreach (var t in tasks)
            {
                var start = t.StartDate.Value.Date;
                var end = t.EndDate.Value.Date;

                if (merged.Count == 0)
                {
                    merged.Add((start, end));
                    continue;
                }

                var last = merged.Last();

                // Nếu giao nhau hoặc sát nhau (không tạo khoảng trống)
                if (start <= last.End)
                {
                    merged[merged.Count - 1] =
                        (last.Start, end > last.End ? end : last.End);
                }
                else
                {
                    merged.Add((start, end));
                }
            }

            // --- KIỂM TRA TRÙNG LỊCH ---
            var overlappingTasks = tasks
                .Where(t =>
                    newStart <= t.EndDate.Value.Date &&
                    newEnd >= t.StartDate.Value.Date
                ).ToList();

            // ❗ Chỉ báo nếu trùng từ 2 task trở lên
            if (overlappingTasks.Any())
            {
                var minStart = overlappingTasks.Min(o => o.StartDate.Value.Date);
                var maxEnd = overlappingTasks.Max(o => o.EndDate.Value.Date);

                return new UserScheduleResult
                {
                    HasOverlap = true,
                    OverlapCount = overlappingTasks.Count,
                    OverlapStart = minStart,
                    OverlapEnd = maxEnd,
                    Message =
                        $"Nhân viên đang bận từ {minStart:dd/MM} đến {maxEnd:dd/MM}. " +
                        $"Task mới của bạn ({newStart:dd/MM} – {newEnd:dd/MM}) " +
                        $"trùng với {overlappingTasks.Count} công việc trong khoảng thời gian này."
                };
            }

            // --- KHÔNG TRÙNG LỊCH → TÌM KHOẢNG TRỐNG ---
            var lastBefore = merged.LastOrDefault(m => m.End <= newStart);

            if (lastBefore.End != default)
            {
                var gapDays = (newStart - lastBefore.End).TotalDays;

                // ❗ Khoảng cách 1 ngày → coi như hợp lệ, không báo
                if (gapDays <= 1)
                {
                    return new UserScheduleResult
                    {
                        HasOverlap = false,
                        FreeDays = 0,
                        Message =
                            "Lịch hợp lệ"
                    };
                }

                // Gap > 1 ngày → thông báo
                return new UserScheduleResult
                {
                    HasOverlap = false,
                    FreeDays = gapDays,
                    FreeFrom = lastBefore.End,
                    FreeTo = newStart,
                    Message =
                        $"Nhân viên đang rảnh {gapDays} ngày trước task mới. " +
                        $"Khoảng trống từ {lastBefore.End:dd/MM} đến {newStart:dd/MM}."
                };
            }

            // ❗ Nhân viên không có task nào trước newStart
            return new UserScheduleResult
            {
                HasOverlap = false,
                Message =
                    $"Nhân viên không có công việc nào trước thời điểm {newStart:dd/MM}."
            };
        }
    }
}
