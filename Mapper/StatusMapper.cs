using JIRA_NTB.Models.Enums;

namespace JIRA_NTB.Helpers
{
    public static class StatusMapper
    {

        public static TaskStatusModel ToEnum(string statusId)
        {
            return statusId?.ToLower() switch
            {
                "status-todo" => TaskStatusModel.Todo,
                "status-inprogress" => TaskStatusModel.InProgress,
                "status-done" => TaskStatusModel.Done,
                _ => TaskStatusModel.Todo
            };
        }

        // Convert từ Enum => StatusId trong DB
        public static string ToStatusId(TaskStatusModel status)
        {
            return status switch
            {
                TaskStatusModel.Todo => "status-todo",
                TaskStatusModel.InProgress => "status-inprogress",
                TaskStatusModel.Done => "status-done",
                _ => "status-todo"
            };
        }
    }
}
