using lxxl.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Caching;

namespace lxxl.Service
{
    /// <summary>
    /// 缓存帮助类 - 使用ASP.NET内置缓存替代静态变量
    /// </summary>
    public class CacheHelper
    {
        private static readonly int CACHE_DURATION_MINUTES = 1; // 缓存1分钟
        
        // 缓存键常量
        private const string DOCTOR_LIST_KEY = "DoctorList";
        private const string CONTENT_LIST_KEY = "ContentList";
        private const string BANNER_LIST_KEY = "BannerList";
        private const string CONTENT_JIESHAO_KEY = "ContentJieShao";
        private const string CONTENT_LICHENG_KEY = "ContentLiCheng";

        /// <summary>
        /// 获取医生列表（带缓存）
        /// </summary>
        public static List<T_Doctor> GetDoctorList()
        {
            var cache = HttpContext.Current.Cache;
            var doctorList = cache[DOCTOR_LIST_KEY] as List<T_Doctor>;
            
            if (doctorList == null)
            {
                using (var db = new TMLSContext())
                {
                    doctorList = db.T_Doctor.Where(o => !o.isDelete && o.IsShow)
                                          .OrderBy(o => o.number)
                                          .ToList();
                }
                
                // 添加到缓存，1分钟后过期
                cache.Insert(DOCTOR_LIST_KEY, doctorList, null, 
                    DateTime.Now.AddMinutes(CACHE_DURATION_MINUTES), 
                    TimeSpan.Zero);
            }
            
            return doctorList;
        }

        /// <summary>
        /// 清除医生列表缓存
        /// </summary>
        public static void ClearDoctorCache()
        {
            var cache = HttpContext.Current.Cache;
            cache.Remove(DOCTOR_LIST_KEY);
        }

        /// <summary>
        /// 获取内容列表（带缓存）
        /// </summary>
        public static List<T_Content> GetContentList()
        {
            var cache = HttpContext.Current.Cache;
            var contentList = cache[CONTENT_LIST_KEY] as List<T_Content>;
            
            if (contentList == null)
            {
                using (var db = new TMLSContext())
                {
                    contentList = new List<T_Content>();
                    long[] menuids = { 1, 2, 3, 4, 5, 6, 11, 12, 13, 14, 15, 16, 21, 22, 23, 24, 25, 26 };
                    
                    foreach (var menuid in menuids)
                    {
                        contentList.AddRange(db.T_Content.Include("Menu")
                            .OrderByDescending(o => o.IsTop)
                            .ThenByDescending(o => o.ModifyTime)
                            .Where(o => !o.IsDelete && o.Type == 1 && o.MenuID == menuid)
                            .Take(6).ToList());
                    }
                }
                
                cache.Insert(CONTENT_LIST_KEY, contentList, null, 
                    DateTime.Now.AddMinutes(CACHE_DURATION_MINUTES), 
                    TimeSpan.Zero);
            }
            
            return contentList;
        }

        /// <summary>
        /// 获取Banner列表（带缓存）
        /// </summary>
        public static List<T_Banner> GetBannerList()
        {
            var cache = HttpContext.Current.Cache;
            var bannerList = cache[BANNER_LIST_KEY] as List<T_Banner>;
            
            if (bannerList == null)
            {
                using (var db = new TMLSContext())
                {
                    bannerList = db.T_Banner.Where(o => !o.IsDelete && o.MenuID == 1)
                                           .OrderBy(o => o.ID)
                                           .ToList();
                }
                
                cache.Insert(BANNER_LIST_KEY, bannerList, null, 
                    DateTime.Now.AddMinutes(CACHE_DURATION_MINUTES), 
                    TimeSpan.Zero);
            }
            
            return bannerList;
        }

        /// <summary>
        /// 获取介绍内容（带缓存）
        /// </summary>
        public static T_Content GetContentJieShao()
        {
            var cache = HttpContext.Current.Cache;
            var content = cache[CONTENT_JIESHAO_KEY] as T_Content;
            
            if (content == null)
            {
                using (var db = new TMLSContext())
                {
                    content = db.T_Content.Where(o => o.MenuID == 7 && o.Type == 2 && !o.IsDelete)
                                         .FirstOrDefault();
                }
                
                if (content != null)
                {
                    cache.Insert(CONTENT_JIESHAO_KEY, content, null, 
                        DateTime.Now.AddMinutes(CACHE_DURATION_MINUTES), 
                        TimeSpan.Zero);
                }
            }
            
            return content;
        }

        /// <summary>
        /// 获取流程内容（带缓存）
        /// </summary>
        public static T_Content GetContentLiCheng()
        {
            var cache = HttpContext.Current.Cache;
            var content = cache[CONTENT_LICHENG_KEY] as T_Content;
            
            if (content == null)
            {
                using (var db = new TMLSContext())
                {
                    content = db.T_Content.Where(o => o.MenuID == 8 && o.Type == 2 && !o.IsDelete)
                                         .FirstOrDefault();
                }
                
                if (content != null)
                {
                    cache.Insert(CONTENT_LICHENG_KEY, content, null, 
                        DateTime.Now.AddMinutes(CACHE_DURATION_MINUTES), 
                        TimeSpan.Zero);
                }
            }
            
            return content;
        }

        /// <summary>
        /// 清除所有缓存
        /// </summary>
        public static void ClearAllCache()
        {
            var cache = HttpContext.Current.Cache;
            cache.Remove(DOCTOR_LIST_KEY);
            cache.Remove(CONTENT_LIST_KEY);
            cache.Remove(BANNER_LIST_KEY);
            cache.Remove(CONTENT_JIESHAO_KEY);
            cache.Remove(CONTENT_LICHENG_KEY);
        }
    }
}
