using System;
using System.Linq;
using System.Web.Mvc;
using lxxl.Service;
using lxxl.Models;

namespace lxxl.Areas.Api.Controllers
{
    /// <summary>
    /// 前端API控制器 - MVC版本，提供JSON接口服务
    /// </summary>
    public class frontendController : Controller
    {
        /// <summary>
        /// 重写OnActionExecuting方法，为所有响应添加CORS头
        /// </summary>
        protected override void OnActionExecuting(ActionExecutingContext filterContext)
        {
            base.OnActionExecuting(filterContext);

            // 添加CORS响应头
            filterContext.HttpContext.Response.Headers.Add("Access-Control-Allow-Origin", "*");
            filterContext.HttpContext.Response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
            filterContext.HttpContext.Response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Accept-Language, Cache-Control, Pragma");
            
            // 处理OPTIONS预检请求
            if (filterContext.HttpContext.Request.HttpMethod == "OPTIONS")
            {
                filterContext.HttpContext.Response.StatusCode = 200;
                filterContext.HttpContext.Response.End();
                return;
            }
        }

        public ActionResult Index()
        {
            string ips = "111";
            return Content(ips);
        }

        /// <summary>
        /// 测试接口 - 用于验证前后端连接
        /// </summary>
        /// <returns>返回测试数据</returns>
        [HttpGet]
        public JsonResult Test()
        {
            try
            {
                var testData = new
                {
                    code = 0,
                    msg = "success",
                    data = new
                    {
                        timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                        message = "API连接测试成功！",
                        version = "1.0.0",
                        environment = "development",
                        server = Environment.MachineName,
                        status = "running",
                        endpoints = new
                        {
                            test = "/api/frontend/test",
                            health = "/api/frontend/health",
                            home = "/api/frontend/GetHomeIndex",
                            search = "/api/frontend/GlobalSearch"
                        }
                    }
                };

                return Json(testData, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                var errorData = new
                {
                    code = 500,
                    msg = "服务器内部错误",
                    data = new
                    {
                        error = ex.Message,
                        timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                    }
                };

                return Json(errorData, JsonRequestBehavior.AllowGet);
            }
        }

        /// <summary>
        /// 健康检查接口
        /// </summary>
        /// <returns>返回服务状态</returns>
        [HttpGet]
        public JsonResult Health()
        {
            try
            {
                var healthData = new
                {
                    code = 0,
                    msg = "success",
                    data = new
                    {
                        status = "healthy",
                        timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                        uptime = Environment.TickCount,
                        memory = GC.GetTotalMemory(false),
                        version = "1.0.0",
                        server = Environment.MachineName,
                        os = Environment.OSVersion.ToString(),
                        framework = Environment.Version.ToString()
                    }
                };

                return Json(healthData, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                var errorData = new
                {
                    code = 500,
                    msg = "服务器内部错误",
                    data = new
                    {
                        error = ex.Message,
                        timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                    }
                };

                return Json(errorData, JsonRequestBehavior.AllowGet);
            }
        }

        /// <summary>
        /// 获取首页数据
        /// 注意：图片路径直接返回数据库中的原始值，前端负责拼接完整的URL
        /// </summary>
        /// <returns>首页数据</returns>
        [HttpGet]
        public ActionResult GetHomeIndex()
        {
            try
            {
                // 调用dataHelper获取真实数据
                var bannerList = CacheHelper.GetBannerList();
                var doctorList = CacheHelper.GetDoctorList();
                
                var homeData = new
                {
                    code = 0,
                    msg = "success",
                    data = new
                    {
                        banners = bannerList.Select(b => new
                        {
                            id = b.ID,
                            title = b.Title ?? "心理健康讲座",
                            subtitle = b.Profile ?? "专业心理咨询服务",
                            image = b.url ?? "/static/images/banner1.jpg",
                            buttonText = "立即报名",
                            date = b.CreateTime.ToString("M月d日 HH:mm")
                        }).Take(3).ToArray(),
                        features = new[]
                        {
                            new
                            {
                                id = 1,
                                title = "心理咨询",
                                description = "和懂你的人聊聊天",
                                image = "/static/images/feature1.jpg",
                                buttonText = "预约咨询",
                                height = 80
                            },
                            new
                            {
                                id = 2,
                                title = "月度精华",
                                description = "5月精华活动3次",
                                image = "/static/images/feature2.jpg",
                                buttonText = "查看详情",
                                height = 160
                            },
                            new
                            {
                                id = 3,
                                title = "心理测量",
                                description = "听一听自己的心声",
                                image = "/static/images/feature3.jpg",
                                buttonText = "开始测试",
                                height = 80
                            },
                            new
                            {
                                id = 4,
                                title = "活动招募",
                                description = "欢迎心理学各界人士参与",
                                image = "/static/images/feature4.jpg",
                                buttonText = "精彩活动",
                                height = 160
                            }
                        },
                        doctors = doctorList.Take(6).Select(d => new
                        {
                            id = d.ID,
                            name = d.name ?? "专业咨询师",
                            avatar = d.topUrl ?? d.url ?? "/static/images/default-doctor.jpg",
                            specialty = d.Specialty ?? "心理咨询",
                            experience = d.WorkYears.HasValue ? $"{d.WorkYears}年经验" : "经验丰富",
                            rating = 4.5, // 默认评分
                            province = d.Province ?? "全国",
                            description = d.introduce ?? d.Profile ?? "专业心理咨询师",
                            price = d.Billing > 0 ? d.Billing : 300,
                            consultHours = d.ConsultHours ?? 1000,
                            billing = d.Billing > 0 ? d.Billing : 300,
                            specialties = d.Specialty ?? "心理咨询"
                        }).ToArray(),
                        activities = new[]
                        {
                            new
                            {
                                id = 1,
                                title = "心理健康月活动",
                                description = "关注心理健康，共建和谐社会",
                                image = "/static/images/activity1.jpg",
                                date = "5月1日-5月31日"
                            }
                        },
                        liveStreams = new[]
                        {
                            new
                            {
                                id = 1,
                                title = "心理减压直播",
                                description = "学会放松，释放压力",
                                image = "/static/images/live1.jpg",
                                time = "今晚8点"
                            }
                        }
                    }
                };

                return Json(homeData, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                var errorData = new
                {
                    code = 500,
                    msg = "获取首页数据失败",
                    data = new
                    {
                        error = ex.Message,
                        timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                    }
                };

                return Json(errorData, JsonRequestBehavior.AllowGet);
            }
        }

        /// <summary>
        /// 全局搜索接口
        /// </summary>
        /// <param name="keyword">搜索关键词</param>
        /// <param name="type">搜索类型</param>
        /// <returns>搜索结果</returns>
        [HttpGet]
        public JsonResult GlobalSearch(string keyword = "", string type = "all")
        {
            try
            {
                if (string.IsNullOrEmpty(keyword))
                {
                    var suggestionsData = new
                    {
                        code = 0,
                        msg = "success",
                        data = new
                        {
                            suggestions = new string[]
                            {
                                "心理咨询",
                                "心理治疗",
                                "抑郁症",
                                "焦虑症",
                                "婚姻咨询",
                                "亲子关系",
                                "职场压力",
                                "情绪管理"
                            },
                            history = new string[]
                            {
                                "心理咨询",
                                "心理治疗"
                            }
                        }
                    };

                    return Json(suggestionsData, JsonRequestBehavior.AllowGet);
                }
                else
                {
                    // 模拟搜索结果
                    var searchData = new
                    {
                        code = 0,
                        msg = "success",
                        data = new
                        {
                            keyword = keyword,
                            type = type,
                            results = new object[]
                            {
                                new
                                {
                                    id = 1,
                                    type = "doctor",
                                    title = "张医生 - 心理咨询师",
                                    description = "专业心理咨询，擅长处理情绪问题",
                                    image = "/static/images/doctor1.jpg",
                                    rating = 4.8
                                },
                                new
                                {
                                    id = 2,
                                    type = "article",
                                    title = "如何缓解焦虑情绪",
                                    description = "实用的焦虑缓解方法分享",
                                    image = "/static/images/article1.jpg",
                                    views = 1234
                                }
                            },
                            total = 2
                        }
                    };

                    return Json(searchData, JsonRequestBehavior.AllowGet);
                }
            }
            catch (Exception ex)
            {
                var errorData = new
                {
                    code = 500,
                    msg = "搜索失败",
                    data = new
                    {
                        error = ex.Message,
                        timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                    }
                };

                return Json(errorData, JsonRequestBehavior.AllowGet);
            }
        }

        /// <summary>
        /// 获取咨询师列表
        /// </summary>
        /// <param name="page">页码</param>
        /// <param name="pageSize">每页数量</param>
        /// <param name="specialty">专业领域</param>
        /// <param name="province">省份</param>
        /// <param name="keyword">关键词搜索（姓名、专业、省份等）</param>
        /// <returns>咨询师列表</returns>
        [HttpGet]
        public JsonResult GetDoctorList(int page = 1, int pageSize = 10, string specialty = "", string province = "", string keyword = "")
        {
            try
            {
                // 调用dataHelper获取咨询师列表
                var allDoctors = CacheHelper.GetDoctorList();

                // 应用筛选条件
                var filteredDoctors = allDoctors.AsQueryable();

                // 关键词搜索
                if (!string.IsNullOrEmpty(keyword))
                {
                    filteredDoctors = filteredDoctors.Where(d => 
                        (d.name != null && d.name.Contains(keyword)) ||
                        (d.Specialty != null && d.Specialty.Contains(keyword)) ||
                        (d.Province != null && d.Province.Contains(keyword)) ||
                        (d.introduce != null && d.introduce.Contains(keyword)) ||
                        (d.Profile != null && d.Profile.Contains(keyword))
                    );
                }

                if (!string.IsNullOrEmpty(specialty))
                {
                    filteredDoctors = filteredDoctors.Where(d => d.Specialty.Contains(specialty));
                }

                if (!string.IsNullOrEmpty(province))
                {
                    filteredDoctors = filteredDoctors.Where(d => d.Province.Contains(province));
                }

                // 应用分页
                var totalCount = filteredDoctors.Count();
                var pagedDoctors = filteredDoctors
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToList();

                var doctorListData = new
                {
                    code = 0,
                    msg = "success",
                    data = new
                    {
                        doctors = pagedDoctors.Select(d => new
                        {
                            id = d.ID,
                            name = string.IsNullOrEmpty(d.name) ? "专业咨询师" : d.name,
                            avatar = !string.IsNullOrEmpty(d.topUrl) ? d.topUrl : (!string.IsNullOrEmpty(d.url) ? d.url : "/static/images/default-avatar.jpg"),
                            specialty = string.IsNullOrEmpty(d.Specialty) ? "心理咨询" : d.Specialty,
                            experience = d.WorkYears.HasValue ? $"{d.WorkYears}年经验" : "经验丰富",
                            rating = 4.5, // 默认评分
                            province = string.IsNullOrEmpty(d.Province) ? "全国" : d.Province,
                            description = !string.IsNullOrEmpty(d.introduce) ? d.introduce : (!string.IsNullOrEmpty(d.Profile) ? d.Profile : "专业心理咨询师"),
                            price = d.Billing
                        }),
                        pagination = new
                        {
                            page = page,
                            pageSize = pageSize,
                            total = totalCount,
                            totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
                        }
                    }
                };

                return Json(doctorListData, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                var errorData = new
                {
                    code = 500,
                    msg = "获取咨询师列表失败",
                    data = new
                    {
                        error = ex.Message,
                        timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                    }
                };

                return Json(errorData, JsonRequestBehavior.AllowGet);
            }
        }

        /// <summary>
        /// 获取活动列表
        /// </summary>
        /// <param name="page">页码</param>
        /// <param name="pageSize">每页数量</param>
        /// <returns>活动列表</returns>
        [HttpGet]
        public JsonResult GetActivityList(int page = 1, int pageSize = 10)
        {
            try
            {
                // 模拟活动数据
                var activities = new[]
                {
                    new
                    {
                        id = 1,
                        title = "心理健康月活动",
                        description = "关注心理健康，共建和谐社会",
                        image = "/static/images/activity1.jpg",
                        date = "5月1日-5月31日",
                        status = "进行中"
                    },
                    new
                    {
                        id = 2,
                        title = "亲子关系讲座",
                        description = "如何建立良好的亲子关系",
                        image = "/static/images/activity2.jpg",
                        date = "6月15日 14:00-16:00",
                        status = "报名中"
                    }
                };

                var activityListData = new
                {
                    code = 0,
                    msg = "success",
                    data = new
                    {
                        activities = activities,
                        pagination = new
                        {
                            page = page,
                            pageSize = pageSize,
                            total = activities.Length,
                            totalPages = 1
                        }
                    }
                };

                return Json(activityListData, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                var errorData = new
                {
                    code = 500,
                    msg = "获取活动列表失败",
                    data = new
                    {
                        error = ex.Message,
                        timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                    }
                };

                return Json(errorData, JsonRequestBehavior.AllowGet);
            }
        }

        /// <summary>
        /// 获取直播列表
        /// </summary>
        /// <param name="page">页码</param>
        /// <param name="pageSize">每页数量</param>
        /// <returns>直播列表</returns>
        [HttpGet]
        public JsonResult GetLiveList(int page = 1, int pageSize = 10)
        {
            try
            {
                // 模拟直播数据
                var liveStreams = new[]
                {
                    new
                    {
                        id = 1,
                        title = "心理减压直播",
                        description = "学会放松，释放压力",
                        image = "/static/images/live1.jpg",
                        time = "今晚8点",
                        status = "即将开始"
                    },
                    new
                    {
                        id = 2,
                        title = "情绪管理技巧",
                        description = "掌握情绪管理的方法",
                        image = "/static/images/live2.jpg",
                        time = "明天下午3点",
                        status = "预约中"
                    }
                };

                var liveListData = new
                {
                    code = 0,
                    msg = "success",
                    data = new
                    {
                        liveStreams = liveStreams,
                        pagination = new
                        {
                            page = page,
                            pageSize = pageSize,
                            total = liveStreams.Length,
                            totalPages = 1
                        }
                    }
                };

                return Json(liveListData, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                var errorData = new
                {
                    code = 500,
                    msg = "获取直播列表失败",
                    data = new
                    {
                        error = ex.Message,
                        timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                    }
                };

                return Json(errorData, JsonRequestBehavior.AllowGet);
            }
        }

        /// <summary>
        /// 获取医生详情
        /// </summary>
        /// <param name="id">医生ID</param>
        /// <returns>医生详情信息</returns>
        [HttpGet]
        public JsonResult GetDoctorDetail(long id)
        {
            try
            {
                using (var db = new TMLSContext())
                {
                    var doctor = db.T_Doctor.Where(o => o.ID == id && !o.isDelete && o.IsShow).FirstOrDefault();
                    if (doctor == null)
                    {
                        return Json(new { code = -1, msg = "医生不存在" }, JsonRequestBehavior.AllowGet);
                    }

                    // 获取医生可预约时间
                    DateTime sTime = DateTime.Now;
                    DateTime endTime = DateTime.Now.AddDays(31);
                    var doctorScheduleList = db.T_DoctorSchedule.Where(o => !o.isDelete && o.doctorID == id && sTime < o.startTime && o.startTime < endTime && o.numSign == 0).OrderBy(o => o.startTime).ToList().Select(o => new
                    {
                        o.ID,
                        o.gId,
                        o.Price,
                        o.maxSign,
                        o.numSign,
                        startDate = o.startTime.ToString("yyyy-MM-dd"),
                        startHH = o.startTime.ToString("HH:mm"),
                        endHH = o.endTime.ToString("HH:mm"),
                        startTime = o.startTime.ToString("yyyy-MM-dd HH:mm"),
                        endTime = o.endTime.ToString("yyyy-MM-dd HH:mm"),
                        createTime = o.createTime.ToString("yyyy-MM-dd HH:mm:ss"),
                        time = (o.endTime - o.startTime).Hours == 0 ? "" : ((o.endTime - o.startTime).Hours + "小时") + ((o.endTime - o.startTime).Minutes == 0 ? "" : ((o.endTime - o.startTime).Minutes + "分钟")),
                        week = o.getWeek(),
                    }).ToList();

                    var doctorData = new
                    {
                        code = 0,
                        msg = "获取成功",
                        data = new
                        {
                            doctor = new
                            {
                                id = doctor.ID,
                                name = doctor.name,
                                specialty = doctor.Specialty,
                                experience = doctor.WorkYears ?? 0,
                                price = doctor.Billing,
                                avatar = doctor.url,
                                description = doctor.introduce,
                                profile = doctor.Profile,
                                qualification = doctor.Qualification,
                                field = doctor.Field,
                                targetGroup = doctor.TargetGroup,
                                consultHours = doctor.ConsultHours ?? 0,
                                workYears = doctor.WorkYears ?? 0,
                                mode = doctor.Mode
                            },
                            timeSlots = doctorScheduleList,
                            hasAvailableTime = doctorScheduleList.Any()
                        }
                    };

                    return Json(doctorData, JsonRequestBehavior.AllowGet);
                }
            }
            catch (Exception ex)
            {
                var errorData = new
                {
                    code = 500,
                    msg = "获取医生详情失败",
                    data = new
                    {
                        error = ex.Message,
                        timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                    }
                };

                return Json(errorData, JsonRequestBehavior.AllowGet);
            }
        }
    }
}
