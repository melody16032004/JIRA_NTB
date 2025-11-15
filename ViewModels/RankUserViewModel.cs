using JIRA_NTB.Models;

namespace JIRA_NTB.ViewModels
{
    public class RankUserViewModel
    {
        public string FullName { get; set; }
        public string Avt { get; set; }
        public List<RankUserAppModel> Apps { get; set; } = new();
    }
}
