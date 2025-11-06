using JIRA_NTB.Data;
using JIRA_NTB.Models;
using JIRA_NTB.Models.Enums;
using JIRA_NTB.Service;
using Microsoft.AspNetCore.Razor.TagHelpers;
using Microsoft.EntityFrameworkCore;

namespace JIRA_NTB.Repository
{
    public class TaskRepository : ITaskRepository
    {
        private readonly AppDbContext _context;

        public TaskRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<TaskItemModel>> GetAllAsync()
        {
            return await _context.Tasks
                .Include(t => t.Project)
                .Include(t => t.Status)
                .Include(t => t.Assignee)
                .ToListAsync();
        }

        public async Task<TaskItemModel?> GetByIdAsync(string id)
        {
            return await _context.Tasks
                .Include(t => t.Project)
                .Include(t => t.Status)
                .Include(t => t.Assignee)
                .FirstOrDefaultAsync(t => t.IdTask == id);
        }

        public async Task<List<TaskItemModel>> GetByProjectIdAsync(string projectId)
        {
            return await _context.Tasks
                .Include(t => t.Status)
                .Include(t => t.Assignee)
                .Where(t => t.ProjectId == projectId)
                .ToListAsync();
        }

        public async Task<List<TaskItemModel>> GetByAssigneeIdAsync(string userId)
        {
            return await _context.Tasks
                .Include(t => t.Project)
                .Include(t => t.Status)
                .Where(t => t.Assignee_Id == userId)
                .ToListAsync();
        }
        public async Task RefreshOverdueStatusAsync()
        {
            var tasks = await _context.Tasks
                .Include(t => t.Status)
                .Where(t => t.EndDate.HasValue)
                .ToListAsync();

            foreach (var t in tasks)
            {
                bool shouldBeOverdue =
                    t.EndDate.Value < DateTime.Now &&
                    t.Status?.StatusName != TaskStatusModel.Done;
                if (t.Overdue != shouldBeOverdue)
                {
                    t.Overdue = shouldBeOverdue;
                }
            }

            await _context.SaveChangesAsync();
        }
        public async Task UpdateAsync(TaskItemModel task)
        {
            _context.Tasks.Update(task);
            await _context.SaveChangesAsync();
        }
        public async Task AddAsync(TaskItemModel task)
        {
            _context.Tasks.Add(task);
            await _context.SaveChangesAsync();
        }
        public async Task DeleteAsync(string id)
        {
            var task = await _context.Tasks.FindAsync(id);
            if (task != null)
            {
                _context.Tasks.Remove(task);
                await _context.SaveChangesAsync();
            }
        }
    }
}
