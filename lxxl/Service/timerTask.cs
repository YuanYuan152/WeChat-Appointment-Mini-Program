using lxxl.Models;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Timers;
using System.Web;

namespace lxxl.Service
{
    public class timerTask
    {
        public static void Execute()
        {
            Timer objTimer = new Timer(1000 * 60 * 60);
            //objTimer.Interval = 1000 * 60 * 6; //这个时间单位毫秒,比如10秒，就写10000   24小时//86400000
            objTimer.Enabled = true;
            objTimer.Elapsed += new ElapsedEventHandler(objTimer_Elapsed);
        }

        private static void objTimer_Elapsed(object sender, ElapsedEventArgs e)
        {
            if (DateTime.Now.Hour <= 3)
            {
                int minute = DateTime.Now.Minute;
                if (minute >= 30 && minute <= 60)
                {

                }
            }
        }

        public static void Write(string str, string name = "tuihuo")
        {
            FileStream fs = new FileStream("C://timerTask/logs/" + name + ".txt", FileMode.Append);
            StreamWriter sw = new StreamWriter(fs);
            //开始写入
            sw.WriteLine(str);
            //清空缓冲区
            sw.Flush();
            //关闭流
            sw.Close();
            fs.Close();
        }

        #region 创建日程表
        /// <summary>
        /// 创建日程表
        /// </summary>
        public static void SetScheduleNew()
        {
            try
            {   
                TMLSContext db = new TMLSContext();
                DateTime time = DateTime.Now.Date;
                List<T_DoctorClassSchedule> DoctorClassSchedulelist = db.T_DoctorClassSchedule.Where(o => !o.isDelete && o.startTime >= time).ToList();//
                int day = 0;
                foreach (var doctorClassSchedule in DoctorClassSchedulelist)//所有
                {
                    DayOfWeek dayOfWeek =(DayOfWeek)Enum.Parse(typeof(DayOfWeek),doctorClassSchedule.week);
                    DateTime startTime = doctorClassSchedule.startTime;
                    string[] startH = doctorClassSchedule.startH.Split(':');
                    int startH1 = int.Parse(startH[0]);
                    int startH2 = int.Parse(startH[1]);
                    string[] endH = doctorClassSchedule.endH.Split(':');
                    int endH1 = int.Parse(endH[0]);
                    int endH2 = int.Parse(endH[1]);
                    for(int i = 0;i<7;i++)
                    {
                        if(startTime.AddDays(i).DayOfWeek==dayOfWeek)
                        {
                            startTime =startTime.AddDays(i);
                            break;
                        }
                    }
                    while (startTime <= doctorClassSchedule.endTime)
                    {
                        DateTime time1 = startTime.AddHours(startH1).AddMinutes(startH2);
                        DateTime time2 = startTime.AddHours(endH1).AddMinutes(endH2);
                        T_DoctorSchedule temp = db.T_DoctorSchedule.SingleOrDefault(o => !o.isDelete && o.doctorID == doctorClassSchedule.doctorID && o.startTime == time1 && o.endTime == time2);
                        if (temp == null)
                        {
                            T_DoctorSchedule DoctorSchedule = new T_DoctorSchedule(doctorClassSchedule.doctorID, time1, time2, doctorClassSchedule.maxSign, doctorClassSchedule.Price, "");
                            DoctorSchedule.week = doctorClassSchedule.week;
                            DoctorSchedule.address = doctorClassSchedule.address;
                            DoctorSchedule.methods = doctorClassSchedule.methods;
                            DoctorSchedule.ClassScheduleId = doctorClassSchedule.ID;
                            db.T_DoctorSchedule.Add(DoctorSchedule);
                        }
                        startTime = startTime.AddDays(7);
                    }
                    
                }
                db.SaveChanges();
                //LogWriter.Default.WriteWarning("每天刷新场地价格(New):" + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss:fff"));
            }
            catch (Exception e)
            {
                //LogWriter.Default.WriteWarning("每天刷新(异常):" + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss:fff"));
            }
        }


        public static void SetOneClassSchedule(T_DoctorClassSchedule doctorClassSchedule)
        {
            using (TMLSContext db = new TMLSContext())
            {
                DayOfWeek dayOfWeek = (DayOfWeek)Enum.Parse(typeof(DayOfWeek), doctorClassSchedule.week);
                DateTime startTime = doctorClassSchedule.startTime;
                string[] startH = doctorClassSchedule.startH.Split(':');
                int startH1 = int.Parse(startH[0]);
                int startH2 = int.Parse(startH[1]);
                string[] endH = doctorClassSchedule.endH.Split(':');
                int endH1 = int.Parse(endH[0]);
                int endH2 = int.Parse(endH[1]);
                for (int i = 0; i < 7; i++)
                {
                    if (startTime.AddDays(i).DayOfWeek == dayOfWeek)
                    {
                        startTime = startTime.AddDays(i);
                        break;
                    }
                }
                while (startTime <= doctorClassSchedule.endTime)
                {
                    DateTime time1 = startTime.AddHours(startH1).AddMinutes(startH2);
                    DateTime time2 = startTime.AddHours(endH1).AddMinutes(endH2);
                    T_DoctorSchedule temp = db.T_DoctorSchedule.SingleOrDefault(o => !o.isDelete && o.doctorID == doctorClassSchedule.doctorID && o.startTime == time1 && o.endTime == time2);
                    if (temp == null)
                    {
                        T_DoctorSchedule DoctorSchedule = new T_DoctorSchedule(doctorClassSchedule.doctorID, time1, time2, doctorClassSchedule.maxSign, doctorClassSchedule.Price, "");
                        DoctorSchedule.week = doctorClassSchedule.week;
                        DoctorSchedule.address = doctorClassSchedule.address;
                        DoctorSchedule.methods = doctorClassSchedule.methods;
                        DoctorSchedule.ClassScheduleId = doctorClassSchedule.ID;
                        db.T_DoctorSchedule.Add(DoctorSchedule);
                    }
                    startTime = startTime.AddDays(7);
                }
                db.SaveChanges();
            }
        }
        #endregion

    }
}