using JIRA_NTB.Models;
using JIRA_NTB.Models.Enums;
using JIRA_NTB.ViewModels;

namespace JIRA_NTB.Services
{
    public interface ITaskService
    {
        Task<TaskBoardViewModel> GetTaskBoardAsync(string userId, IList<string> roles, string? projectId = null, string? taskId = null);
        Task<List<TaskViewModel>> GetTasksByStatusAsync(string userId, IList<string> roles,
            string statusId, int page, int pageSize, string? projectId = null);
        Task<TaskStatusChangeResult> UpdateTaskStatusAsync(
            string taskId,
            string newStatusId,
           string userId,
            IList<string> roles);
        Task<TaskItemModel?> GetTaskByIdAsync(string taskId,string userId, IList<string> roles);
        Task<(bool success, string message)> UpdateTaskAsync(TaskViewModel model, List<IFormFile> files);
        Task<TaskStatusChangeResult> DeleteTaskAsync(
            string taskId,
           string userId,
            IList<string> roles);
        Task<TaskStatusChangeResult> RestoreTaskAsync(
            string taskId,
            string previousStatusId,
            DateTime? previousCompletedDate,
           string userId,
            IList<string> roles);
        Task<TaskStatusChangeResult> UndoTaskStatusAsync(
            string taskId,
            string previousStatusId,
            DateTime? previousCompletedDate,
           string userId,
            IList<string> roles);
        Task<IEnumerable<UserModel>> GetAllMemberProjectAsync(string projectId, string? userId);
        Task<(bool success, string message, string? taskId)> CreateTaskAsync(CreateTaskRequest request);
        Task<List<TaskItemModel>> GetTasksByProjectIdAsync(string projectId,string userId, IList<string> roles);
        Task<int> GetTotalTaskCountByStatusAsync(
       string userId,
        IList<string> roles,
        string statusId,
        string? projectId = null);
        Task<bool> ReassignTaskAsync(ReassignTaskDto dto, string reassignedById);
        Task<UserScheduleResult> CheckUserScheduleAsync(
    string userId,
    DateTime newStart,
    DateTime newEnd);
        Task<PagedResult<LogStatusDTO>> GetLogsAsync(string userId, IList<string> roles,
      int page, int pageSize);
    }
}
