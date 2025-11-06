using JIRA_NTB.Models;
using JIRA_NTB.Models.Enums;

namespace JIRA_NTB.Service
{
    public class Helper
    {
        public string GetStatusDisplay(TaskStatusModel status)
        {
            return status switch
            {
                TaskStatusModel.Todo => "Chưa bắt đầu",
                TaskStatusModel.InProgress => "Đang thực hiện",
                TaskStatusModel.Done => "Hoàn thành",
                _ => "Không xác định"
            };
        }
        public static bool IsOverdue(TaskItemModel task)
        {
            return task.EndDate.HasValue
                   && task.EndDate.Value < DateTime.Now
                   && task.Status?.StatusName != TaskStatusModel.Done;
        }
    }
}
