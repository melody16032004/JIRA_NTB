using JIRA_NTB.Models;
using JIRA_NTB.Services;
using JIRA_NTB.ViewModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Linq;

namespace JIRA_NTB.Controllers
{
    [Authorize]
    public class RankUserController : Controller
    {
        private readonly RankingService _rankingService;
        private readonly LateCheckInService _lateService;

        public RankUserController()
        {
            _rankingService = new RankingService();
            _lateService = new LateCheckInService();
        }

        public IActionResult Index(DateTime? fromTime)
        {
            var rawData = _rankingService.GetTopAppsPerUser(3);

            var grouped = rawData
                .GroupBy(x => new { x.FullName, x.Avt })
                .Select(g => new RankUserViewModel
                {
                    FullName = g.Key.FullName,
                    Avt = g.Key.Avt,
                    Apps = g.OrderBy(x => x.RankId).ToList()
                })
                .ToList();

            // Top người đi muộn
            var lateUsers = _lateService.GetTopLateUsers(fromTime ?? DateTime.Now.AddDays(-30), 3);

            // Đẩy vào ViewModel tổng hợp
            var model = new RankUserPageViewModel
            {
                TopAppsPerUser = grouped,
                TopLateUsers = lateUsers,
                FromTime = fromTime
            };

            return View(model);
        }
    }
}
