using JIRA_NTB.Models;
using System.Collections.Generic;

namespace JIRA_NTB.ViewModels
{
    public class RankUserPageViewModel
    {
        public List<RankUserViewModel> TopAppsPerUser { get; set; } = new();
        public List<LateUserModel> TopLateUsers { get; set; } = new();
    }
}
