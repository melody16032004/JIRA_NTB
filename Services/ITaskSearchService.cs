using JIRA_NTB.Data;

namespace JIRA_NTB.Services
{
    public interface ITaskSearchService
    {
        Task<List<TaskSuggestionDto>> SuggestAsync(string keyword, string? projectId);
        Task<TaskEntity?> FindByFullNameAsync(string fullName, string? projectId);
        Task IndexTaskAsync(TaskEntity task);
        Task IndexTasksAsync(IEnumerable<TaskEntity> tasks);
        Task<List<TaskSuggestionDto>> FuzzySearchAsync(string keyword, string? projectId);
        Task<List<TaskSuggestionDto>> SmartSuggestAsync(string keyword, string? projectId);
        Task UpdateIndexAsync(TaskEntity task);
        Task DeleteIndexAsync(string taskId);
    }
}
