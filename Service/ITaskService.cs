using JIRA_NTB.Models;
using JIRA_NTB.ViewModels;

namespace JIRA_NTB.Service
{
    public interface ITaskService
    {
        Task<TaskBoardViewModel> GetTaskBoardAsync();
        Task<TaskStatusChangeResult> UpdateTaskStatusAsync(string taskId, string newStatusId);
        Task<(bool success, string message)> UpdateTaskAsync(TaskViewModel model, List<IFormFile> files);
        Task<(bool success, string message)> DeleteTaskAsync(string taskId);

        Task<TaskStatusChangeResult> UndoTaskStatusAsync(string taskId, string previousStatusId);
        Task<IEnumerable<UserModel>> GetAllMemberProjectAsync(string projectId);
        Task<(bool success, string message, string? taskId)> CreateTaskAsync(CreateTaskRequest request);

    }
}
