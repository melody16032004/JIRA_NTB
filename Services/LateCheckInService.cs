using System;
using System.Collections.Generic;
using System.Data.SqlClient;
using JIRA_NTB.Models;

namespace JIRA_NTB.Services
{
    public class LateCheckInService
    {
        //private const string ConnectionString = "Server=10.13.21.178;Database=JIRA_NTB;User Id=sa;Password=1;TrustServerCertificate=True;";
        private const string ConnectionString = "Server=NTBIT-PC\\SQL2019;Database=JIRA_NTB;User Id=sa;Password=@dmin@338;TrustServerCertificate=True;MultipleActiveResultSets=true";

        public List<LateUserModel> GetTopLateUsers(DateTime fromTime, int topN = 3)
        {
            var results = new List<LateUserModel>();

            string query = $@"
                SELECT TOP ({topN})
                    u.FullName,
                    u.Avt,
                    COUNT(c.Id) AS LateCount
                FROM checkIns c
                JOIN Users u ON c.UserId = u.Id
                WHERE 
                    c.TimeCheckIn > @FromTime
                    AND CAST(c.TimeCheckIn AS time) > '08:30'   -- điều kiện đi muộn
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
                            results.Add(new LateUserModel
                            {
                                FullName = reader["FullName"].ToString(),
                                Avt = reader["Avt"].ToString(),
                                LateCount = Convert.ToInt32(reader["LateCount"])
                            });
                        }
                    }
                }
            }

            return results;
        }
    }
}
