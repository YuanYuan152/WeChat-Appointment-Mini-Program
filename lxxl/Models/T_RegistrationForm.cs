using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace lxxl.Models
{
    //咨询预约登记表
    public class T_RegistrationForm
    {
        [Key]
        [HiddenInput(DisplayValue = false)]
        public long ID { get; set; }

        [Display(Name = "逻辑Id")]
        [StringLength(32)]
        public string gId { get; set; }

        [Display(Name = "患者")]
        public long UserID { get; set; }

        [Display(Name = "患者ID")]//外键关联患者
        [ForeignKey("UserID")]
        public T_User User { get; set; }

        public long doctorID { get; set; }

        [Required]
        [Display(Name = "姓名")]
        public string name { get; set; }

        [Display(Name = "性别")]
        public string gender { get; set; }

        [Display(Name = "年龄")]
        public int age { get; set; }

        [Display(Name = "民族")]
        public string nation { get; set; }

        [Display(Name = "手机号")]
        public string mobile { get; set; }

        [Display(Name = "微信号")]
        public string wechat { get; set; }

        [Display(Name = "否是本人")]
        public string isSelf { get; set; }

        [Display(Name = "关系")]
        public string relationship { get; set; }

        [Display(Name = "职业")]
        public string career { get; set; }

        [Display(Name = "婚姻状况")]
        public string maritalStatus { get; set; }

        [Display(Name = "文化程度")]
        public string educationalLevel { get; set; }

        [Display(Name = "宗教信仰")]
        public string religion { get; set; }

        [Display(Name = "现居住城市")]
        public string city { get; set; }

        [Display(Name = "和谁同住")]
        public string cohabit { get; set; }

        [Display(Name = "了解途径")]
        public string gateway { get; set; }

        [Display(Name = "咨询主题")]
        public string subject { get; set; }

        [Display(Name = "是否经医院诊断")]
        public string diagnosis { get; set; }

        [Display(Name = "是否在服药")]
        public string takeMedicine { get; set; }

        [Display(Name = "困扰持续的时间")]
        public string troubledTime { get; set; }

        [Display(Name = "近期遭遇事件")]
        public string recentEvents { get; set; }

        [Display(Name = "心理咨询经历")]
        public string experience { get; set; }

        [Display(Name = "情绪状态")]
        public string emotionalState { get; set; }

        [Display(Name = "意志行为")]
        public string acOfWill { get; set; }

        [Display(Name = "躯体表现")]
        public string manifestations { get; set; }

        [Display(Name = "紧急程度")]
        public string urgency { get; set; }

        [Display(Name = "我目前的情况不太紧急")]
        public string urgency1 { get; set; }

        [Display(Name = "我目前的情况比较紧急")]
        public string urgency2 { get; set; }

        [Display(Name = "Item25")]
        public string Item25 { get; set; }

        [Display(Name = "Item26")]
        public string Item26 { get; set; }

        [Display(Name = "服务形式")]
        public string serviceForm { get; set; }

        [Display(Name = "咨费区间")]
        public string feeRange { get; set; }

        [Display(Name = "告知信息")]
        public string otherMsg { get; set; }

        [Display(Name = "电话沟通")]
        public string telephoning { get; set; }

        [Display(Name = "Item31")]
        public string Item31 { get; set; }

        [Display(Name = "Item32")]
        public string Item32 { get; set; }

        [Display(Name = "Item33")]
        public string Item33 { get; set; }

        [Display(Name = "Item34")]
        public string Item34 { get; set; }

        [Display(Name = "Item35")]
        public string Item35 { get; set; }

        [Display(Name = "是否已处理")]
        public bool IsTop { get; set; }

        [Display(Name = "咨询次数")]
        public int Frequency { get; set; }

        [Display(Name = "咨询ID")]
        public string ConsultationIDs { get; set; }

        [Display(Name = "显示")]
        public bool IsShow { get; set; }

        [Display(Name = "是否删除")]
        public bool IsDelete { get; set; }

        [Display(Name = "创建时间")]
        public DateTime CreateTime { get; set; }

        [Display(Name = "修改时间")]
        public DateTime ModifyTime { get; set; }

        [Display(Name = "备用字段1")]
        public string Backup1 { get; set; }

        [Display(Name = "备注")]
        public string Remark { get; set; }

        [Display(Name = "备用1")]
        public string Remark1 { get; set; }

        [Display(Name = "备用2")]
        public string Remark2 { get; set; }

        public T_RegistrationForm()
        {
            this.gId = Guid.NewGuid().ToString("N");
            this.CreateTime = DateTime.Now;
            this.ModifyTime = DateTime.Now;
            this.IsTop = false;
            this.IsShow = false;
            this.IsDelete = false;
            this.Frequency = 0;
            this.name = "";
            this.gender = "";
            this.age = 0;
            this.nation = "";
            this.mobile = "";
            this.wechat = "";
            this.isSelf = "";
            this.relationship = "";
            this.career = "";
            this.maritalStatus = "";
            this.educationalLevel = "";
            this.religion = "";
            this.city = "";
            this.cohabit = "";
            this.gateway = "";
            this.subject = "";
            this.diagnosis = "";
            this.takeMedicine = "";
            this.troubledTime = "";
            this.recentEvents = "";
            this.experience = "";
            this.emotionalState = "";
            this.acOfWill = "";
            this.manifestations = "";
            this.urgency = "";
            this.urgency1 = "";
            this.urgency2 = "";
            this.Item25 = "";
            this.Item26 = "";
            this.serviceForm = "";
            this.feeRange = "";
            this.otherMsg = "";
            this.telephoning = "";
            this.Item31 = "";
            this.Item32 = "";
            this.Item33 = "";
            this.Item34 = "";
            this.Item35 = "";
        }

        public T_RegistrationForm(long userID)
        {
            this.gId = Guid.NewGuid().ToString("N");
            this.UserID = UserID;
            this.CreateTime = DateTime.Now;
            this.ModifyTime = DateTime.Now;
            this.IsTop = false;
            this.IsShow = false;
            this.IsDelete = false;
            this.Frequency = 0;
            this.name = "";
            this.gender = "";
            this.age = 0;
            this.nation = "";
            this.mobile = "";
            this.wechat = "";
            this.isSelf = "";
            this.relationship = "";
            this.career = "";
            this.maritalStatus = "";
            this.educationalLevel = "";
            this.religion = "";
            this.city = "";
            this.cohabit = "";
            this.gateway = "";
            this.subject = "";
            this.diagnosis = "";
            this.takeMedicine = "";
            this.troubledTime = "";
            this.recentEvents = "";
            this.experience = "";
            this.emotionalState = "";
            this.acOfWill = "";
            this.manifestations = "";
            this.urgency = "";
            this.urgency1 = "";
            this.urgency2 = "";
            this.Item25 = "";
            this.Item26 = "";
            this.serviceForm = "";
            this.feeRange = "";
            this.otherMsg = "";
            this.telephoning = "";
            this.Item31 = "";
            this.Item32 = "";
            this.Item33 = "";
            this.Item34 = "";
            this.Item35 = "";
        }
    }
}
