using lxxl.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace lxxl.Service
{
    /// <summary>
    /// 数据帮助类 - 保持向后兼容，但推荐使用CacheHelper
    /// 注意：此类使用静态变量，在Web应用中可能存在并发问题
    /// </summary>
    public class dataHelper
    {
        // 注意：静态DbContext在Web应用中是危险的，应该避免使用
        [Obsolete("静态DbContext可能导致内存泄漏和并发问题，建议使用using语句")]
        public static TMLSContext db = new TMLSContext();
        
        public static int EXPIRED_SECONDS = 60;
        private static DateTime isAPIDateTime = DateTime.MinValue;
        
        // 使用锁来保护静态变量的并发访问
        private static readonly object _lock = new object();
        private static List<T_Content> _contentList = new List<T_Content>();
        private static List<T_Banner> _bannerLst = new List<T_Banner>();
        private static T_Content _contentJieShao = new T_Content();
        private static T_Content _contentLiCheng = new T_Content();
        private static List<T_Doctor> _doctorLst = new List<T_Doctor>();

        // 属性封装，提供线程安全访问
        public static List<T_Content> ContentList
        {
            get { lock (_lock) { return _contentList; } }
            private set { lock (_lock) { _contentList = value; } }
        }

        public static List<T_Banner> BannerLst
        {
            get { lock (_lock) { return _bannerLst; } }
            private set { lock (_lock) { _bannerLst = value; } }
        }

        public static T_Content ContentJieShao
        {
            get { lock (_lock) { return _contentJieShao; } }
            private set { lock (_lock) { _contentJieShao = value; } }
        }

        public static T_Content ContentLiCheng
        {
            get { lock (_lock) { return _contentLiCheng; } }
            private set { lock (_lock) { _contentLiCheng = value; } }
        }

        public static List<T_Doctor> DoctorLst
        {
            get { lock (_lock) { return _doctorLst; } }
            private set { lock (_lock) { _doctorLst = value; } }
        }

        public static List<T_Content> GetContentList()
        {
            lock (_lock)
            {
                if (ContentList == null || ContentList.Count() == 0 || isAPIDateTime.AddSeconds(EXPIRED_SECONDS) < DateTime.Now)
                {
                    SetapiData();
                }
                return ContentList;
            }
        }

        public static T_Content GetContentJieShao()
        {
            lock (_lock)
            {
                if (ContentJieShao == null)
                {
                    SetapiData();
                }
                return ContentJieShao;
            }
        }

        public static T_Content GetContentLiCheng()
        {
            lock (_lock)
            {
                if (ContentLiCheng == null)
                {
                    SetapiData();
                }
                return ContentLiCheng;
            }
        }

        public static List<T_Banner> GetBannerLst()
        {
            lock (_lock)
            {
                if (BannerLst == null || BannerLst.Count() == 0 || isAPIDateTime.AddSeconds(EXPIRED_SECONDS) < DateTime.Now)
                {
                    SetapiData();
                }
                return BannerLst;
            }
        }

        public static List<T_Doctor> GetDoctorLst()
        {
            lock (_lock)
            {
                if (DoctorLst == null || DoctorLst.Count() == 0)
                {
                    SetDoctorData();
                }
                else if (isAPIDateTime.AddSeconds(EXPIRED_SECONDS) < DateTime.Now)
                {
                    SetapiData();
                }
                return DoctorLst;
            }
        }

        public static void ReSetDoctor()
        {
            lock (_lock)
            {
                DoctorLst.Clear();
                isAPIDateTime = DateTime.MinValue; // 强制下次重新获取数据
            }
        }

        private static void SetDoctorData()
        {
            // 在锁内部，已经确保线程安全
            try
            {
                using (var localDb = new TMLSContext()) // 使用局部DbContext
                {
                    DoctorLst = localDb.T_Doctor.Where(o => !o.isDelete && o.IsShow).OrderBy(o => o.number).ToList();
                }
            }
            catch (Exception ex)
            {
                // 记录日志或处理异常
                System.Diagnostics.Debug.WriteLine("SetDoctorData error: " + ex.Message);
                DoctorLst = new List<T_Doctor>(); // 返回空列表而不是null
            }
        }

        private static void SetapiData()
        {
            // 在锁内部，已经确保线程安全
            try
            {
                using (var localDb = new TMLSContext()) // 使用局部DbContext
                {
                    ContentList.Clear();
                    long[] menuids = { 1, 2, 3, 4, 5, 6, 11, 12, 13, 14, 15, 16, 21, 22, 23, 24, 25, 26 };
                    foreach (var menuid in menuids)
                    {
                        ContentList.AddRange(localDb.T_Content.Include("Menu").OrderByDescending(o => o.IsTop).ThenByDescending(o => o.ModifyTime).Where(o => !o.IsDelete && o.Type == 1 && o.MenuID == menuid).Take(6).ToList());
                    }
                    ContentJieShao = localDb.T_Content.Where(o => o.MenuID == 7 && o.Type == 2 && !o.IsDelete).FirstOrDefault();
                    ContentLiCheng = localDb.T_Content.Where(o => o.MenuID == 8 && o.Type == 2 && !o.IsDelete).FirstOrDefault();
                    
                    BannerLst.Clear();
                    BannerLst = localDb.T_Banner.Where(o => !o.IsDelete && o.MenuID == 1).OrderBy(o => o.ID).ToList();

                    DoctorLst.Clear();
                    DoctorLst = localDb.T_Doctor.Where(o => !o.isDelete && o.IsShow).OrderBy(o => o.number).ToList();

                    isAPIDateTime = DateTime.Now;
                }
            }
            catch (Exception ex)
            {
                // 记录日志或处理异常
                System.Diagnostics.Debug.WriteLine("SetapiData error: " + ex.Message);
                // 确保变量不为null
                if (ContentList == null) ContentList = new List<T_Content>();
                if (BannerLst == null) BannerLst = new List<T_Banner>();
                if (DoctorLst == null) DoctorLst = new List<T_Doctor>();
            }
        }
    }
}