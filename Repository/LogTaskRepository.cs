using JIRA_NTB.Data;
using JIRA_NTB.Models;
using JIRA_NTB.Models.Enums;
using JIRA_NTB.Services;
using JIRA_NTB.ViewModels;
using Microsoft.EntityFrameworkCore;

namespace JIRA_NTB.Repository
{
    public class LogTaskRepository : ILogTaskRepository
    {
        private readonly AppDbContext _context;
        public LogTaskRepository(AppDbContext context)
        {
            _context = context;
        }
        public async Task<PagedResult<LogStatusDTO>> GetLogsAsync(string userId, IList<string> roles,
            int page, int pageSize)
        {
            IQueryable<LogStatusUpdate> query = _context.LogStatusUpdates;

            string role = roles.FirstOrDefault();

            if (role != "ADMIN")
            {
                IQueryable<string> taskIdsQuery = Enumerable.Empty<string>().AsQueryable();

                switch (role)
                {
                    case "EMPLOYEE":
                        taskIdsQuery = _context.Tasks
                            .Where(t => t.Assignee_Id == userId)
                            .Select(t => t.IdTask);
                        break;

                    case "LEADER":
                        var projectIds = _context.Projects
                            .Where(p => p.UserId == userId)
                            .Select(p => p.IdProject);

                        taskIdsQuery = _context.Tasks
                            .Where(t => projectIds.Contains(t.ProjectId))
                            .Select(t => t.IdTask);
                        break;

                    default:
                        return new PagedResult<LogStatusDTO>();
                }

                query = query.Where(log => taskIdsQuery.Contains(log.IdTask));
            }

            // Total before paging
            int totalCount = await query.CountAsync();

            // Paging
            var logs = await query
                .Include(l => l.Task)
                .Include(l => l.User)
                .Include(l => l.PreviousStatus)
                .Include(l => l.NewStatus)
                .OrderByDescending(l => l.updateAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(l => new LogStatusDTO
                {
                    LogId = l.LogId,
                    TaskName = l.Task.NameTask,
                    UserName = l.User.FullName,
                    PreviousStatus = l.PreviousStatus != null
                        ? Helper.GetStatusDisplay(l.PreviousStatus.StatusName)
                        : "N/A",
                    NewStatus = l.NewStatus != null
                        ? Helper.GetStatusDisplay(l.NewStatus.StatusName)
                        : "N/A",
                    UpdateAt = l.updateAt
                })
                .ToListAsync();

            return new PagedResult<LogStatusDTO>
            {
                Items = logs,
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize
            };
        }
    }
}
