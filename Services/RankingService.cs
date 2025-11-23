using System.Collections.Generic;
using System.Data.SqlClient;
using JIRA_NTB.Models;

namespace JIRA_NTB.Services
{
    public class RankingService
    {
        private const string ConnectionString = "Server=NTBIT-PC\\SQL2019;Database=JIRA_NTB;User Id=sa;Password=@dmin@338;TrustServerCertificate=True;MultipleActiveResultSets=true";

        public List<RankUserAppModel> GetTopAppsPerUser(int topN = 3)
        {
            var results = new List<RankUserAppModel>();

            string query = $@"
                WITH RawData AS (
                    SELECT 
                        u.FullName,
                        u.Avt,
                        l.AppName,
                        CASE 
                            WHEN l.TimeEnd IS NULL OR l.TimeEnd < l.TimeStart THEN 0
                            ELSE DATEDIFF(MINUTE, l.TimeStart, l.TimeEnd)
                        END AS SessionDuration
                    FROM LogDevices l
                    JOIN Users u ON l.DeviceId = u.DeviceAddress
                ),
                UserAppStats AS (
                    SELECT 
                        FullName,
                        Avt,
                        AppName,
                        SUM(SessionDuration) AS TotalDurationMinutes,
                        COUNT(*) AS OpenCount
                    FROM RawData
                    GROUP BY FullName, Avt, AppName    
                ),
                RankedApps AS (
                    SELECT 
                        FullName,
                        Avt,
                        AppName,
                        TotalDurationMinutes,
                        OpenCount,
                        ROW_NUMBER() OVER (
                            PARTITION BY FullName 
                            ORDER BY TotalDurationMinutes DESC
                        ) AS RankId
                    FROM UserAppStats
                )
                SELECT 
                    FullName,
                    Avt,
                    AppName,
                    TotalDurationMinutes,
                    OpenCount,
                    RankId
                FROM RankedApps
                WHERE RankId <= {topN}
                ORDER BY FullName, RankId;
            ";

            using (SqlConnection conn = new SqlConnection(ConnectionString))
            {
                conn.Open();

                using (SqlCommand cmd = new SqlCommand(query, conn))
                using (SqlDataReader reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        results.Add(new RankUserAppModel
                        {
                            FullName = reader["FullName"].ToString(),
                            Avt = reader["Avt"].ToString(),
                            AppName = reader["AppName"].ToString(),
                            TotalDurationMinutes = Convert.ToInt32(reader["TotalDurationMinutes"]),
                            OpenCount = Convert.ToInt32(reader["OpenCount"]),
                            RankId = Convert.ToInt32(reader["RankId"])
                        });
                    }
                }
            }

            return results;
        }
    }
}
