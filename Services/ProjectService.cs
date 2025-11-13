using JIRA_NTB.Data;
using JIRA_NTB.Models;
using JIRA_NTB.Models.Enums;
using JIRA_NTB.Repository;
using JIRA_NTB.ViewModels;
using Microsoft.EntityFrameworkCore;

namespace JIRA_NTB.Services
{
    public class ProjectService : IProjectService
    {
        private readonly AppDbContext _context;

        public ProjectService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<ProjectDetailViewModel> GetProjectDetailAsync(string id)
        {
            // 1️⃣ Thông tin dự án
            var project = await _context.Projects
                .Include(p => p.Manager)
                .Include(p => p.Status)
                .FirstOrDefaultAsync(p => p.IdProject == id);

            if (project == null)
                return new ProjectDetailViewModel { Project = null };

            // 2️⃣ Thành viên
            var members = await _context.ProjectManagers
                .Where(pm => pm.ProjectId == id)
                .Include(pm => pm.User)
                .Select(pm => pm.User)
                .ToListAsync();

            // 3️⃣ Task thuộc dự án
            var tasks = await _context.Tasks
                .Include(t => t.Status)
                .Include(t => t.Assignee)
                .Where(t => t.ProjectId == id)
                .ToListAsync();

            // 4️⃣ Biểu đồ trạng thái tổng (cũ - giữ nguyên)
            var taskStatusData = tasks
                .Where(t => t.Status != null)
                .GroupBy(t => t.Status.StatusName)
                .Select(group => new { StatusEnumAsInt = group.Key, Count = group.Count() })
                .AsEnumerable()
                .Select(d => new
                {
                    StatusLabel = ((TaskStatusModel)d.StatusEnumAsInt).ToString(),
                    Count = d.Count
                })
                .OrderBy(x => x.StatusLabel);

            // 5️⃣ Dữ liệu Gantt (giữ nguyên)
            var ganttData = tasks
                .Where(t => t.StartDate != null && t.EndDate != null)
                .Select(t => new GanttTaskData
                {
                    Name = t.NameTask,
                    Assignee = t.Assignee?.FullName ?? "Chưa giao",
                    Priority = t.Priority ?? "Medium",
                    Start = ((DateTimeOffset)t.StartDate.Value).ToUnixTimeMilliseconds(),
                    End = ((DateTimeOffset)t.EndDate.Value).ToUnixTimeMilliseconds(),
                    Overdue = (t.EndDate < DateTime.Now && t.StatusId != TaskStatusModel.Done.ToString()),
                    Status = t.Status != null
                        ? (((TaskStatusModel)t.Status.StatusName) switch
                        {
                            TaskStatusModel.Todo => "Lên kế hoạch",
                            TaskStatusModel.InProgress => "Đang thực hiện",
                            TaskStatusModel.Done => "Hoàn thành",
                            _ => "Không xác định"
                        })
                        : "Không xác định"
                })
                .ToList();

            // 6️⃣ Thống kê theo từng user
            var userStatsList = new List<UserTaskStatViewModel>();

            var assignedTasks = tasks.Where(t => t.Assignee != null).ToList();
            var tasksByUser = assignedTasks.GroupBy(t => t.Assignee);

            foreach (var userGroup in tasksByUser)
            {
                var user = userGroup.Key;
                var userTasks = userGroup.ToList();

                // 🟣 6a. Biểu đồ cột Priority
                var priorityData = userTasks
                    .Where(t => !string.IsNullOrEmpty(t.Priority))
                    .GroupBy(t => t.Priority)
                    .Select(g => new { Label = g.Key, Count = g.Count() })
                    .OrderBy(d => d.Label)
                    .ToList();

                var statusCounts = new Dictionary<string, int>
                {
                    { "Todo", 0 },
                    { "InProgress", 0 },
                    { "Done", 0 },
                    { "Overdue", 0 },
                    { "Late", 0 }
                };

                foreach (var t in userTasks)
                {
                    // 1️⃣ Overdue (đã Done nhưng quá hạn)
                    if (t.Overdue && t.Status?.StatusName == TaskStatusModel.Done)
                    {
                        statusCounts["Overdue"]++;
                    }
                    // 2️⃣ Late (chưa Done mà quá hạn)
                    else if (t.EndDate < DateTime.Now && t.Status?.StatusName != TaskStatusModel.Done)
                    {
                        statusCounts["Late"]++;
                    }
                    // 3️⃣ Còn lại: theo trạng thái thật
                    else if (t.Status != null)
                    {
                        var statusEnum = (TaskStatusModel)t.Status.StatusName;
                        switch (statusEnum)
                        {
                            case TaskStatusModel.Todo:
                                statusCounts["Todo"]++;
                                break;
                            case TaskStatusModel.InProgress:
                                statusCounts["InProgress"]++;
                                break;
                            case TaskStatusModel.Done:
                                statusCounts["Done"]++;
                                break;
                        }
                    }
                }
                // 🧩 Biểu đồ trạng thái tổng hợp
                var statusChart = new ChartData
                {
                    Labels = statusCounts.Keys.ToList(),
                    Series = statusCounts.Values.ToList()
                };

                // 📝 Danh sách task chi tiết (kèm Overdue)
                var userTaskList = userTasks.Select(t => new UserTaskBriefViewModel
                {
                    TaskId = t.IdTask,
                    NameTask = t.NameTask,
                    Priority = t.Priority ?? "Medium",
                    Overdue = t.Overdue,
                    Status = t.Status != null
                        ? ((TaskStatusModel)t.Status.StatusName).ToString()
                        : "Không xác định"
                }).ToList();

                // 🧠 Kết hợp vào UserStat
                var userStat = new UserTaskStatViewModel
                {
                    UserId = user.Id,
                    UserName = user.FullName ?? user.UserName,
                    UserAvatarUrl = user.Avt,
                    TotalTasks = userTasks.Count,

                    // 🔹 Cột Priority
                    PriorityChart = new ChartData
                    {
                        Labels = priorityData.Select(d => d.Label).ToList(),
                        Series = priorityData.Select(d => d.Count).ToList()
                    },

                    // 🔸 Donut Status
                    StatusChart = statusChart,

                    Tasks = userTaskList
                };

                userStatsList.Add(userStat);
            }

            // 7️⃣ Tổng hợp kết quả
            var viewModel = new ProjectDetailViewModel
            {
                Project = project,
                Members = members,
                Tasks = tasks,
                TaskStatusChart = new ChartData
                {
                    Labels = taskStatusData.Select(d => d.StatusLabel).ToList(),
                    Series = taskStatusData.Select(d => d.Count).ToList()
                },
                TaskTimelineData = ganttData,
                UserStats = userStatsList.OrderBy(u => u.UserName).ToList()
            };

            return viewModel;
        }
    }
}
