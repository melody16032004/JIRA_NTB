using JIRA_NTB.Data;
using JIRA_NTB.Models;
using Microsoft.EntityFrameworkCore;

namespace JIRA_NTB.Repository
{
    public class ProjectRepository : IProjectRepository
    {
        private readonly AppDbContext _context;

        public ProjectRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<ProjectModel>> GetAllAsync()
        {
            return await _context.Projects
                .Include(p => p.Status)
                .Include(p => p.Manager)
                .ToListAsync();
        }

        public async Task<ProjectModel?> GetByIdAsync(string id)
        {
            return await _context.Projects
                .Include(p => p.Status)
                .Include(p => p.Manager)
                .FirstOrDefaultAsync(p => p.IdProject == id);
        }

        public async Task<List<ProjectModel>> GetByUserIdAsync(string userId)
        {
            return await _context.Projects
                .Include(p => p.Status)
                .Where(p => p.UserId == userId)
                .ToListAsync();
        }
    }
}
