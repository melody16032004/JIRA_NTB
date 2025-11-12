using JIRA_NTB.Models;
using JIRA_NTB.Models.Enums;
using JIRA_NTB.ViewModels;

namespace JIRA_NTB.Services
{
    public interface ITaskService
    {
        Task<TaskBoardViewModel> GetTaskBoardAsync(UserModel user, IList<string> roles);
        Task<List<TaskViewModel>> GetTasksByStatusAsync(UserModel user, IList<string> roles,
            string statusId, int page, int pageSize);
        Task<TaskStatusChangeResult> UpdateTaskStatusAsync(string taskId, string newStatusId);
        Task<TaskItemModel?> GetTaskByIdAsync(string taskId, UserModel user, IList<string> roles);
        Task<(bool success, string message)> UpdateTaskAsync(TaskViewModel model, List<IFormFile> files);
        Task<(bool success, string message)> DeleteTaskAsync(string taskId);

        Task<TaskStatusChangeResult> UndoTaskStatusAsync(string taskId,
                                                             string previousStatusId,
                                                             DateTime? previousCompletedDate);
        Task<IEnumerable<UserModel>> GetAllMemberProjectAsync(string projectId);
        Task<(bool success, string message, string? taskId)> CreateTaskAsync(CreateTaskRequest request);
        Task<List<TaskItemModel>> GetTasksByProjectIdAsync(string projectId, UserModel user, IList<string> roles);


    }
}
