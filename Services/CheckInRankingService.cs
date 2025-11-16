using System;
using System.Collections.Generic;
using System.Data.SqlClient;
using JIRA_NTB.Models;

namespace JIRA_NTB.Services
{
    public class CheckInRankingService
    {
        private const string ConnectionString = "Server=MARS;Database=JIRA_NTB;Integrated Security=True;";

        public List<TopCheckInUsers> GetTopUsersByCheckIn(DateTime fromTime, int topN = 3)
        {
            var results = new List<TopCheckInUsers>();

            string query = $@"
                SELECT TOP ({topN})
                    u.FullName,
                    u.Avt,
                    COUNT(c.Id) AS CheckInCount
                FROM checkIns c
                JOIN Users u ON c.UserId = u.Id
                WHERE c.TimeCheckIn > @FromTime
                GROUP BY u.FullName, u.Avt
                ORDER BY COUNT(c.Id) DESC;
            ";

            using (SqlConnection conn = new SqlConnection(ConnectionString))
            {
                conn.Open();
                using (SqlCommand cmd = new SqlCommand(query, conn))
                {
                    cmd.Parameters.AddWithValue("@FromTime", fromTime);

                    using (SqlDataReader reader = cmd.ExecuteReader())
                    {
                        while (reader.Read())
                        {
                            results.Add(new TopCheckInUsers
                            {
                                FullName = reader["FullName"].ToString(),
                                Avt = reader["Avt"].ToString(),
                                CheckInCount = Convert.ToInt32(reader["CheckInCount"])
                            });
                        }
                    }
                }
            }

            return results;
        }
    }
}
