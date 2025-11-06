namespace JIRA_NTB.Models.Test
{
    public class Project
    {
        public string? Id { get; set; }
        public string? Name { get; set; }
        public string? Description { get; set; }
        public int Progress { get; set; }
        public string? StartDate { get; set; }
        public string? EndDate { get; set; }
        public FileItem? File { get; set; }
        public List<TaskItem>? Tasks { get; set; }
    }
}
