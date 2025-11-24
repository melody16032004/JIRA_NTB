namespace JIRA_NTB.Data
{
    public class TaskEntity
    {
        public string Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string ProjectId { get; set; }
    }
    public record TaskSuggestionDto(string FullName);

}
