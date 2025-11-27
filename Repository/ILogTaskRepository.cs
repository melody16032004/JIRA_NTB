using JIRA_NTB.Models;
using JIRA_NTB.ViewModels;

namespace JIRA_NTB.Repository
{
    public interface ILogTaskRepository
    {
        Task<PagedResult<LogStatusDTO>> GetLogsAsync(string userId, IList<string> roles,
            int page, int pageSize);
    }
}
