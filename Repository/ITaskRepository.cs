using JIRA_NTB.Models;

namespace JIRA_NTB.Repository
{
    public interface ITaskRepository
    {
        Task<List<TaskItemModel>> GetAllAsync();
        Task<List<TaskItemModel>> GetAllFilteredAsync(UserModel user, IList<string> roles);
        Task<List<TaskItemModel>> GetTasksByStatusPagedAsync(UserModel user,IList<string> roles,
            string? statusId = null, int page = 1, int pageSize = 10, string? projectId = null);
        Task<int> GetTaskCountByStatusAsync(
            UserModel user,
            IList<string> roles,
            string? statusId = null,
            string? projectId = null);
        Task<TaskItemModel?> GetByIdFilteredAsync(string taskId, UserModel user, IList<string> roles);
        Task<TaskItemModel?> GetByIdAsync(string id);
        Task<List<TaskItemModel>> GetByProjectIdAsync(string projectId, UserModel user, IList<string> roles);
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
