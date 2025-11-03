using JIRA_NTB.Data;
using JIRA_NTB.Models;
using JIRA_NTB.Models.Enums;
using Microsoft.EntityFrameworkCore;

namespace JIRA_NTB.Repository
{
    public class StatusRepository : IStatusRepository
    {
        private readonly AppDbContext _context;

        public StatusRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<Status>> GetAllAsync()
        {
            return await _context.Statuses.ToListAsync();
        }

        public async Task<Status?> GetByIdAsync(string id)
        {
            return await _context.Statuses.FirstOrDefaultAsync(s => s.StatusId == id);
        }
        public async Task<Status?> GetByStatusNameAsync(TaskStatusModel statusName)
        {
            return await _context.Statuses.FirstOrDefaultAsync(s => s.StatusName == statusName);
        }
    }
}
