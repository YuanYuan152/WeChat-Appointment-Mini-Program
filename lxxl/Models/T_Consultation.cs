using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Web.Mvc;

namespace lxxl.Models
{
    /// <summary>
    /// 咨询记录状态常量
    /// </summary>
    public static class ConsultationState
    {
        public const short Cancelled = -1;        // 已取消
        public const short Unpaid = 0;            // 用户未付款
        public const short Accepted = 1;          // 已接受
        public const short TimeConfirmed = 2;     // 已确认预约时间
        public const short UserConfirmed = 3;     // 用户已确认预约时间
        public const short Reported = 4;          // 已填报
        public const short Closed = 5;           // 已关单
        public const short Transferred = 6;      // 转立项
        public const short Completed = 10;       // 已完成咨询
    }

    //咨询表
    public class T_Consultation
    {
        [Key]
        [HiddenInput(DisplayValue = false)]
        public long ID { get; set; }

        [Display(Name = "逻辑Id")]
        [StringLength(32)]
        public string gId { get; set; }

        [Display(Name = "订单号")]
        public string OrderNumber { get; set; }

        [Required]
        [Display(Name = "类型")]
        public int type { get; set; }

        [Display(Name = "患者")]
        public long UserID { get; set; }

        [Display(Name = "患者ID")]//外键关联患者
        [ForeignKey("UserID")]
        public T_User User { get; set; }
        
        public long doctorID { get; set; }

        [Display(Name = "医生ID")]//外键关联医生
        [ForeignKey("doctorID")]
        public T_Doctor doctor { get; set; }

        [Display(Name = "推荐医师ID")]
        public long TDoctorID { get; set; }

        public long adminID { get; set; }

        [Display(Name = "管理员ID")]//外键关联管理员
        [ForeignKey("adminID")]
        public T_Admin admin { get; set; }

        [Display(Name = "微信openid")]
        [StringLength(32)]
        public string openid { get; set; }

        [Display(Name = "咨询人姓名")]
        [StringLength(100)]
        public string name { get; set; }

        [Display(Name = "联系方式")]
        [StringLength(20)]
        public string tel { get; set; }

        [Display(Name = "邮箱")]
        [StringLength(100)]
        public string email { get; set; }
        
        [Display(Name = "状态")]
        public short State { get; set; }        //0.用户未付款  //1.已接受  //2.已确认预约时间  //3.用户已确认预约时间  //4.已填报  //5.已关单  //6.转立项  //-1.已取消  //>=10.已完成咨询
        //复诊则对应初诊ID
        [Display(Name = "会诊类型")]
        public long ConsultationID { get; set; }

        [Display(Name = "预付费用")]//初诊300//2.复诊打折
        public double PayCost { get; set; }

        [Display(Name = "付费时间")]
        public DateTime? PayTime { get; set; }

        [Display(Name = "支付方式")]//1.微信支付 2.余额支付 3余额+微信 4现金
        public short? PayType { get; set; }

        [Required]
        [Display(Name = "是否确认")]
        public bool IsSure { get; set; }

        [Display(Name = "预约时间")]
        public DateTime? SureTime { get; set; }

        [Display(Name = "结算金额")]//初始化为0结算时金额大于预付金额则需补缴费用，小于预交费用则退费
        public double Cost { get; set; }

        [Display(Name = "折扣")]//0~1默认为1
        public double Discount { get; set; }

        [Display(Name = "会诊耗时")]
        public int SpendTime { get; set; }

        [Display(Name = "结算时间")]
        public DateTime? SettleTime { get; set; }

        [Display(Name = "单位")]
        [StringLength(100)]
        public string hospital { get; set; }               

        [Display(Name = "咨询内容")]
        public string content1 { get; set; }

        [Display(Name = "具体问题")]
        public string problems { get; set; }

        [Display(Name = "预期咨询时间")]
        public string expectedTime { get; set; }

        [Display(Name = "备注")]
        public string remark { get; set; }

        [Display(Name = "预约咨询时间")]
        public DateTime appointmentTime { get; set; }

        [Display(Name = "预约单处理人")]
        [StringLength(100)]
        public string handler { get; set; }

        [Display(Name = "咨询时间")]
        public DateTime cTime { get; set; }

        [Display(Name = "咨询结束时间")]
        public DateTime eTime { get; set; }

        [Display(Name = "咨询时长")]
        public double duration { get; set; }

        [Display(Name = "咨询方式")]
        [StringLength(32)]
        public string methods { get; set; }

        [Display(Name = "地点")]
        public string address { get; set; }

        [Display(Name = "咨询专家")]
        [StringLength(100)]
        public string expert { get; set; }

        [Display(Name = "咨询记录")]
        public string record { get; set; }

        [Display(Name = "文件")]
        public string upfile { get; set; }

        [Display(Name = "评分")]
        public short score { get; set; }

        [Display(Name = "评论")]
        public string discuss { get; set; }

        [Display(Name = "备用2")]
        public string remark2 { get; set; }

        [Display(Name = "备用3")]
        public string remark3 { get; set; }
        
        [Required]
        [Display(Name = "是否删除")]
        public bool isDelete { get; set; }

        [Required]
        [Display(Name = "添加时间")]
        public DateTime createTime { get; set; }

        [Required]
        [Display(Name = "更新时间")]
        public DateTime updateTime { get; set; }
       

        [Display(Name = "后台备注")]
        public string homeRenark { get; set; }

        public T_Consultation()
        {
            this.gId = Guid.NewGuid().ToString("N");
            this.OrderNumber =  "jxl" + DateTime.Now.ToString("yyyyMMddHHmmssfff");
            this.isDelete = false;
            this.createTime = DateTime.Now;
            this.updateTime = DateTime.Now;
            this.cTime = DateTime.Parse("1970-01-01");
            this.eTime = DateTime.Parse("1970-01-01");
            this.appointmentTime = DateTime.Now;
            this.ConsultationID = 0;//0是初诊，复诊则是初诊ID
            this.cTime = DateTime.Now;
            this.duration = 0;
            this.score = 0;           
            this.IsSure = false;
            this.State = 0;
            this.PayCost = 300;
            this.Cost = 0;
            this.PayType = 0;
            this.Discount = 1;
            this.SpendTime = 0;
            this.adminID = 1;
        }

        public T_Consultation(long patientid, long doctorid, double payCost,DateTime appointmentTime)
        {
            this.gId = Guid.NewGuid().ToString("N");
            this.OrderNumber = "jxl" + DateTime.Now.ToString("yyyyMMddHHmmssfff") ;
            this.createTime = DateTime.Now;
            this.updateTime = DateTime.Now;
            this.cTime = appointmentTime;
            this.eTime = DateTime.Parse("1970-01-01");
            this.appointmentTime = appointmentTime;
            this.isDelete = false;
            this.IsSure = false;
            this.ConsultationID = 0;//0是初诊，复诊则是初诊ID
            this.State = 0;
            this.PayCost = payCost;
            this.Cost = 0;
            this.PayType = 0;
            this.Discount = 1;
            this.SpendTime = 0;
            this.adminID = 1;
            this.UserID = patientid;
            this.doctorID = doctorid;

        }

        /// <summary>
        /// 获取该会诊的患者信息
        /// </summary>
        /// <returns></returns>
        public T_User GetPatient()
        {
            TMLSContext db = new TMLSContext();
            T_User patient = db.T_User.Where(o => o.ID == this.UserID).FirstOrDefault();
            return patient;
        }

        /// <summary>
        /// 获取该会诊推荐医师
        /// </summary>
        /// <returns></returns>
        public T_Doctor GetTDoctor()
        {
            TMLSContext db = new TMLSContext();
            T_Doctor Doctor = db.T_Doctor.Include("Hospital").Include("Department").Where(o => o.ID == this.TDoctorID).FirstOrDefault();
            return Doctor;
        }

        /// <summary>
        /// 检查是否可以转换到指定状态
        /// </summary>
        /// <param name="newState">目标状态</param>
        /// <returns>是否可以转换</returns>
        public bool CanTransitionTo(short newState)
        {
            switch (this.State)
            {
                case ConsultationState.Cancelled:
                    return false; // 已取消状态不能转换
                case ConsultationState.Unpaid:
                    return newState == ConsultationState.Accepted || newState == ConsultationState.Cancelled;
                case ConsultationState.Accepted:
                    return newState == ConsultationState.TimeConfirmed || newState == ConsultationState.Cancelled;
                case ConsultationState.TimeConfirmed:
                    return newState == ConsultationState.UserConfirmed || newState == ConsultationState.Cancelled;
                case ConsultationState.UserConfirmed:
                    return newState == ConsultationState.Reported || newState == ConsultationState.Cancelled;
                case ConsultationState.Reported:
                    return newState == ConsultationState.Closed || newState == ConsultationState.Transferred;
                case ConsultationState.Closed:
                    return newState == ConsultationState.Transferred;
                case ConsultationState.Transferred:
                    return false; // 转立项后不能转换
                default:
                    if (this.State >= ConsultationState.Completed)
                    {
                        return false; // 已完成状态不能转换
                    }
                    return false;
            }
        }

        /// <summary>
        /// 获取该会诊状态说明
        /// </summary>
        /// <returns></returns>
        public string GetStateDescription()
        {
            string description = "未知";
            switch (this.State)
            {
                case ConsultationState.Cancelled:
                    description = "已取消";
                    break;
                case ConsultationState.Unpaid:
                    description = "用户未付款";
                    break;
                case ConsultationState.Accepted:
                    description = "已接受";
                    break;
                case ConsultationState.TimeConfirmed:
                    description = "已确认预约时间";
                    break;
                case ConsultationState.UserConfirmed:
                    description = "用户已确认预约时间";
                    break;
                case ConsultationState.Reported:
                    description = "已填报";
                    break;
                case ConsultationState.Closed:
                    description = "已关单";
                    break;
                case ConsultationState.Transferred:
                    description = "转立项";
                    break;
                default:
                    if (this.State >= ConsultationState.Completed)
                    {
                        description = "已完成咨询";
                    }
                    else
                    {
                        description = "未知状态";
                    }
                    break;                
            }
            return description;
        }
    }
}
