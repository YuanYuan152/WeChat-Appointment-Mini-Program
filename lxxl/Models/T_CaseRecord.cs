using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Web.Mvc;

namespace lxxl.Models
{
    //个案记录表
    public class T_CaseRecord
    {
        [Key]
        [HiddenInput(DisplayValue = false)]
        public long ID { get; set; }

        [Display(Name = "逻辑Id")]
        [StringLength(32)]
        public string gId { get; set; }

        [Display(Name = "咨询表")]
        public long ConsultationID { get; set; }

        [Display(Name = "咨询表ID")]//外键关联咨询表
        [ForeignKey("ConsultationID")]
        public T_Consultation Consultation { get; set; }

        [Required]
        [Display(Name = "类型")]
        public int type { get; set; }

        [Display(Name = "患者ID")]
        public long UserID { get; set; }
        
        [Display(Name = "医生ID")]
        public long DoctorID { get; set; }

        [Display(Name = "管理员ID")]
        public long adminID { get; set; }

        [Display(Name = "主观描述")]
        public string SubjectiveDescription { get; set; }

        [Display(Name = "客观描述")]
        public string ObjectiveDescription { get; set; }

        [Display(Name = "风险等级评估")]
        public string RiskLevelAssessment { get; set; }

        [Display(Name = "咨询要点")]
        public string ConsultationPoints { get; set; }
        
        [Display(Name = "是否诊断/就医")]
        [StringLength(50)]
        public string Item1X { get; set; }        
        
        [Display(Name = "是否诊断/就医其他")]
        [StringLength(200)]
        public string Item1Other { get; set; }
        
        [Display(Name = "支持系统")]
        [StringLength(50)]
        public string Item2X { get; set; }        
        
        [Display(Name = "支持系统其他")]
        [StringLength(200)]
        public string Item2Other { get; set; }

        [Display(Name = "自我伤害")]
        [StringLength(50)]
        public string Item3X { get; set; }        
        
        [Display(Name = "自我伤害其他")]
        [StringLength(200)]
        public string Item3Other { get; set; }

        [Display(Name = "伤害他人")]
        [StringLength(50)]
        public string Item4X { get; set; }        
        
        [Display(Name = "伤害他人其他")]
        [StringLength(200)]
        public string Item4Other { get; set; }

        [Display(Name = "自我照顾")]
        [StringLength(50)]
        public string Item5X { get; set; }        
        
        [Display(Name = "自我照顾其他")]
        [StringLength(200)]
        public string Item5Other { get; set; }

        [Display(Name = "重大事件")]
        [StringLength(50)]
        public string Item6X { get; set; }        
        
        [Display(Name = "重大事件其他")]
        [StringLength(200)]
        public string Item6Other { get; set; }

        [Display(Name = "家族史")]
        [StringLength(50)]
        public string Item7X { get; set; }        
        
        [Display(Name = "家族史其他")]
        [StringLength(200)]
        public string Item7Other { get; set; }

        [Display(Name = "疾病史")]
        [StringLength(50)]
        public string Item8X { get; set; }        
        
        [Display(Name = "疾病史其他")]
        [StringLength(200)]
        public string Item8Other { get; set; }

        [Display(Name = "创伤史")]
        [StringLength(50)]
        public string Item9X { get; set; }        
        
        [Display(Name = "创伤史其他")]
        [StringLength(200)]
        public string Item9Other { get; set; }

        [Display(Name = "风险等级")]
        [StringLength(50)]
        public string ItemX { get; set; }        
        
        [Display(Name = "风险等级其他")]
        [StringLength(200)]
        public string ItemOther { get; set; }

        [Display(Name = "11")]
        [StringLength(50)]
        public string Item11X { get; set; }        
        
        [Display(Name = "11其他")]
        [StringLength(200)]
        public string Item11Other { get; set; }

        [Display(Name = "12")]
        [StringLength(50)]
        public string Item12X { get; set; }        
        
        [Display(Name = "12其他")]
        [StringLength(200)]
        public string Item12Other { get; set; }

        [Display(Name = "13")]
        [StringLength(50)]
        public string Item13X { get; set; }        
        
        [Display(Name = "13其他")]
        [StringLength(200)]
        public string Item13Other { get; set; }

        [Display(Name = "14")]
        [StringLength(50)]
        public string Item14X { get; set; }        
        
        [Display(Name = "14其他")]
        [StringLength(200)]
        public string Item14Other { get; set; }

        [Display(Name = "编辑次数")]
        public short EditeTime { get; set; }

        [Required]
        [Display(Name = "是否确认")]
        public bool IsSure { get; set; }

        [Display(Name = "备注")]
        public string remark { get; set; }
        
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

        public T_CaseRecord()
        {
            this.gId = Guid.NewGuid().ToString("N");
            this.isDelete = false;
            this.createTime = DateTime.Now;
            this.updateTime = DateTime.Now;
            this.ConsultationID = 0;
            this.EditeTime = 1;
            this.score = 0;
            this.type = 1;
            this.IsSure = false;
            this.adminID = 1;
        }

        public T_CaseRecord(string gId)
        {
            this.gId = gId;
            this.isDelete = false;
            this.createTime = DateTime.Now;
            this.updateTime = DateTime.Now;
            this.ConsultationID = 0;
            this.EditeTime = 1;
            this.score = 0;
            this.type = 1;
            this.IsSure = false;
            this.adminID = 1;
        }

        public T_CaseRecord(string gId,long patientid, long doctorid, long ConsultationID, DateTime appointmentTime)
        {
            this.gId = gId;
            this.createTime = DateTime.Now;
            this.updateTime = DateTime.Now;
            this.EditeTime = 1;
            this.isDelete = false;
            this.score = 0;
            this.type = 1;
            this.IsSure = false;
            this.ConsultationID = ConsultationID;
            this.adminID = 1;
            this.UserID = patientid;
            this.DoctorID = doctorid;

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
        /// 获取医师
        /// </summary>
        /// <returns></returns>
        public T_Doctor GetDoctor()
        {
            TMLSContext db = new TMLSContext();
            T_Doctor Doctor = db.T_Doctor.Where(o => o.ID == this.DoctorID).FirstOrDefault();
            return Doctor;
        }

        /// <summary>
        /// 获取该会诊推荐医师
        /// </summary>
        /// <returns></returns>
        public T_Consultation GetConsultation()
        {
            TMLSContext db = new TMLSContext();
            T_Consultation Consultation = db.T_Consultation.Where(o => o.ID == this.ConsultationID).FirstOrDefault();
            return Consultation;
        }
    }
}
