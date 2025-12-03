using JIRA_NTB.Models;
using JIRA_NTB.ViewModels;

namespace JIRA_NTB.Repository
{
    public interface ITaskRepository
    {
        Task<List<TaskViewModel>> GetTaskViewModelsAsync(
       string userId,
       IList<string> roles,
       string? projectId = null,
       string? taskId = null);
        Task<List<TaskItemModel>> GetTasksByStatusPagedAsync(string userId,IList<string> roles,
            string? statusId = null, int page = 1, int pageSize = 10, string? projectId = null);

        Task<List<TaskViewModel>> GetTasksByStatusPagedViewModelAsync(
        string userId,
        IList<string> roles,
        string? statusId = null,
        int page = 1,
        int pageSize = 10,
        string? projectId = null);

        Task<int> GetTaskCountByStatusAsync(
            string userId,
            IList<string> roles,
            string? statusId = null,
            string? projectId = null);
        Task<TaskItemModel?> GetByIdFilteredAsync(string taskId, string userId, IList<string> roles);
        Task<TaskItemModel?> GetByIdAsync(string id);
        Task<List<TaskItemModel>> GetByProjectIdAsync(string projectId, string userId, IList<string> roles);
        Task<List<TaskItemModel>> GetByAssigneeIdAsync(string userId);
        Task UpdateAsync(TaskItemModel task);
        Task RefreshOverdueStatusAsync();
        Task AddAsync(TaskItemModel task);
        Task DeleteAsync(string id);
        Task AddLogAsync(LogTaskModel log);
        Task SaveChangesAsync();
        Task AddStatusLog(LogStatusUpdate log);
        Task<List<TaskItemModel>> GetSchedule(string userId);
    }
}
