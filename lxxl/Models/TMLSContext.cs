using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Data.Entity;

namespace lxxl.Models
{
    public class TMLSContext:DbContext
    {
        public DbSet<T_Admin> T_Admin { get; set; }//管理员表
        public DbSet<T_Area> T_Area { get; set; }//地区数据表
        public DbSet<T_Menu> T_Menu { get; set; }//菜单列表
        public DbSet<T_Content> T_Content { get; set; }//文章列表

        public DbSet<T_Role> T_Role { get; set; }//权限角色表

        public DbSet<T_User> T_User { get; set; }//用户表

        public DbSet<T_SystemSettings> T_SystemSettings { get; set; }//系统设置表
        public DbSet<T_EmailSettings> T_EmailSettings { get; set; }//邮箱设置表

        public DbSet<T_Log> T_Log { get; set; }//T_Log

        public DbSet<T_Banner> T_Banner { get; set; }//T_Banner  

        public DbSet<T_Department> T_Department { get; set; }//科室数据表

        public DbSet<T_Hospital> T_Hospital { get; set; }//医院数据表

        public DbSet<T_HospitalDepartment> T_HospitalDepartment { get; set; }//医院科室

        public DbSet<T_Doctor> T_Doctor { get; set; }//医生表
        public DbSet<T_DoctorClassSchedule> T_DoctorClassSchedule { get; set; }//医生排期设置
        public DbSet<T_DoctorSchedule> T_DoctorSchedule { get; set; }//医生排期

        public DbSet<T_FsSign> T_FsSign { get; set; }//医生签到
        
        public DbSet<T_Consultation> T_Consultation { get; set; }//咨询表
        public DbSet<T_ConsultationRecord> T_ConsultationRecord { get; set; }//咨询记录表

        public DbSet<T_Course> T_Course { get; set; }//课程表  
        public DbSet<T_Field> T_Field { get; set; }//领域

        public DbSet<T_Examiner> T_Examiner { get; set; }//考官表  

        public DbSet<T_ExaminerCourse> T_ExaminerCourse { get; set; }//考官课程对应表

        public DbSet<T_MessageRecord> T_MessageRecord { get; set; }//信息记录表

        public DbSet<T_InfoData> T_InfoData { get; set; }//资料表

        public DbSet<T_Order> T_Order { get; set; }//订单归总表
        public DbSet<T_OrderItem> T_OrderItem { get; set; }//订单明细表
        public DbSet<T_PayLog> T_PayLog { get; set; }//支付日志,仅包含用户线上付费日志
        
        public DbSet<T_Feedback> T_Feedback { get; set; }//意见反馈

        public DbSet<T_Action> T_Action { get; set; }//报名活动

        public DbSet<T_Form> T_Form { get; set; }//表单
        public DbSet<T_ItemType> T_ItemType { get; set; }//表单题目类型表
        public DbSet<T_Item> T_Item { get; set; }//表单题目
        public DbSet<T_Option> T_Option { get; set; }//表单选项表
        public DbSet<T_SubUser> T_SubUser { get; set; }//用户提交表
        public DbSet<T_SubUserData> T_SubUserData { get; set; }//用户提交答案表
        public DbSet<T_Seacrh> T_Seacrh { get; set; }//检索表

        public DbSet<T_EditLog> T_EditLog { get; set; }//操作记录
        public DbSet<T_CaseRecord> T_CaseRecord { get; set; }//个案记录表
        public DbSet<T_RegistrationForm> T_RegistrationForm { get; set; }//咨询预约登记表

        // 新增：小程序统一账号体系
        public DbSet<AppAccount> AppAccount { get; set; }
        public DbSet<AppRoleBinding> AppRoleBinding { get; set; }
        public DbSet<AppLoginSession> AppLoginSession { get; set; }
    }

    public class TMLDBInitializer : DropCreateDatabaseIfModelChanges<TMLSContext>
    {
        protected override void Seed(TMLSContext db)
        {
            //db.T_Admin.Add(new T_Admin("admin", "111111", 1,"Admin"));

            ////一级菜单
            //db.T_Menu.Add(new T_Menu("首页", 0, 1, 1, true));
            //db.T_Menu.Add(new T_Menu("心理课程", 0, 1, 2, true));
            //db.T_Menu.Add(new T_Menu("心理咨询", 0, 1, 3, true));
            //db.T_Menu.Add(new T_Menu("知识", 0, 1, 4, true));
            //db.T_Menu.Add(new T_Menu("济心理", 0, 1, 5, true));
            //db.T_Menu.Add(new T_Menu("同心理", 0, 1, 6, true));
            //db.T_Menu.Add(new T_Menu("关于我们", 0, 1, 7, true));

            //db.SaveChanges();

            ////db.T_Banner.Add(new T_Banner(1, "连心心理", "/Public/images/20210131150000.jpg", "欢迎来到连心心理", 1, ""));
            //db.T_Banner.Add(new T_Banner(1, "同心理", "/Public/images/20210131150000.jpg", "同心理", 1));
            //db.T_Banner.Add(new T_Banner(1, "济心理", "/Public/images/20210131150000.jpg", "济心理", 2));

            //db.T_Role.Add(new T_Role("管理员", "管理员"));
            //db.T_Role.Add(new T_Role("咨询师", "咨询师"));
            //db.T_Role.Add(new T_Role("专家", "专家"));

            //db.T_SystemSettings.Add(new T_SystemSettings(1, "预约天数", 30));
            //db.T_SystemSettings.Add(new T_SystemSettings(2, "幼儿&儿童", 1));
            //db.T_SystemSettings.Add(new T_SystemSettings(2, "青少年", 1));
            //db.T_SystemSettings.Add(new T_SystemSettings(2, "伴侣", 1));
            //db.T_SystemSettings.Add(new T_SystemSettings(2, "家庭", 1));
            //db.T_SystemSettings.Add(new T_SystemSettings(2, "成年人", 1));
            //db.T_SystemSettings.Add(new T_SystemSettings(2, "老年人", 1));
            //db.T_SystemSettings.Add(new T_SystemSettings(2, "孕产妇", 1));
            //db.T_SystemSettings.Add(new T_SystemSettings(2, "留学生", 1));
            //db.T_SystemSettings.Add(new T_SystemSettings(2, "性少数人群", 1));

            //db.T_Field.Add(new T_Field("情绪困扰", "情绪困扰", 0, 1));
            //db.T_Field.Add(new T_Field("婚姻恋爱", "婚姻恋爱", 0, 1));
            //db.T_Field.Add(new T_Field("人际关系", "人际关系", 0, 1));
            //db.T_Field.Add(new T_Field("家庭困扰", "家庭困扰", 0, 1));
            //db.T_Field.Add(new T_Field("个人成长", "个人成长", 0, 1));
            //db.T_Field.Add(new T_Field("学业职场", "学业职场", 0, 1));
            //db.T_Field.Add(new T_Field("亲子教育", "亲子教育", 0, 1));
            //db.T_Field.Add(new T_Field("心理健康", "心理健康", 0, 1));
            //db.T_Field.Add(new T_Field("焦虑", "焦虑", 1, 2));
            //db.T_Field.Add(new T_Field("无意义感", "无意义感", 1, 2));
            //db.T_Field.Add(new T_Field("易怒", "易怒", 1, 2)); 
            //db.T_Field.Add(new T_Field("孤独", "孤独", 1, 2));
            //db.T_Field.Add(new T_Field("孕期焦虑", "孕期焦虑", 1, 2));
            //db.T_Field.Add(new T_Field("产后抑郁", "产后抑郁", 1, 2));
            //db.T_Field.Add(new T_Field("情绪不稳定", "情绪不稳定", 1, 2));
            //db.T_Field.Add(new T_Field("抑郁", "抑郁", 1, 2));
            //db.T_Field.Add(new T_Field("空虚感", "空虚感", 1, 2));
            //db.T_Field.Add(new T_Field("内疚", "内疚", 1, 2));
            //db.T_Field.Add(new T_Field("伴侣沟通", "伴侣沟通", 1, 2)); 

            //db.T_Field.Add(new T_Field("安全感", "安全感", 2, 2));
            //db.T_Field.Add(new T_Field("婚姻质量", "婚姻质量", 2, 2));
            //db.T_Field.Add(new T_Field("情感淡漠", "情感淡漠", 2, 2));
            //db.T_Field.Add(new T_Field("感情变故", "感情变故", 2, 2));
            //db.T_Field.Add(new T_Field("婚姻危机", "婚姻危机", 2, 2));
            //db.T_Field.Add(new T_Field("夫妻关系", "夫妻关系", 2, 2));

            //db.T_Field.Add(new T_Field("沟通不畅", "沟通不畅", 3, 2));
            //db.T_Field.Add(new T_Field("讨好型人格", "讨好型人格", 3, 2));
            //db.T_Field.Add(new T_Field("信任问题", "信任问题", 3, 2));
            //db.T_Field.Add(new T_Field("社交回避", "社交回避", 3, 2));
            //db.T_Field.Add(new T_Field("社交技能", "社交技能", 3, 2));
            //db.T_Field.Add(new T_Field("个人界限", "个人界限", 3, 2));
             
            //db.T_Field.Add(new T_Field("成长创伤", "成长创伤", 4, 2));
            //db.T_Field.Add(new T_Field("家庭冲突", "家庭冲突", 4, 2));
            //db.T_Field.Add(new T_Field("成长枷锁", "成长枷锁", 4, 2));
            //db.T_Field.Add(new T_Field("父母沟通", "父母沟通", 4, 2));
            //db.T_Field.Add(new T_Field("育儿分歧", "育儿分歧", 4, 2));
            //db.T_Field.Add(new T_Field("婆媳关系", "婆媳关系", 4, 2));
            //db.T_Field.Add(new T_Field("个人空间", "个人空间", 4, 2));
            
            //db.T_Field.Add(new T_Field("自尊自信", "自尊自信", 5, 2));
            //db.T_Field.Add(new T_Field("自我封闭", "自我封闭", 5, 2));
            //db.T_Field.Add(new T_Field("完美主义", "完美主义", 5, 2));
            //db.T_Field.Add(new T_Field("理想主义", "理想主义", 5, 2));
            //db.T_Field.Add(new T_Field("女性成长", "女性成长", 5, 2));
            //db.T_Field.Add(new T_Field("男性成长", "男性成长", 5, 2));
            //db.T_Field.Add(new T_Field("跨文化适应", "跨文化适应", 5, 2)); 

            //db.T_Field.Add(new T_Field("学业压力", "学业压力", 6, 2));
            //db.T_Field.Add(new T_Field("留学适应", "留学适应", 6, 2));
            //db.T_Field.Add(new T_Field("职场倦怠", "职场倦怠", 6, 2));
            //db.T_Field.Add(new T_Field("职业迷茫", "职业迷茫", 6, 2));
            //db.T_Field.Add(new T_Field("职场人际关系", "职场人际关系", 6, 2));
            //db.T_Field.Add(new T_Field("工作家庭冲突", "工作家庭冲突", 6, 2));
 
            //db.T_Field.Add(new T_Field("亲子沟通", "", 7, 2));
            //db.T_Field.Add(new T_Field("青春期", "", 7, 2));
            //db.T_Field.Add(new T_Field("中高考压力", "", 7, 2));
            //db.T_Field.Add(new T_Field("厌学", "", 7, 2));
            //db.T_Field.Add(new T_Field("青少年抑郁", "", 7, 2));
            //db.T_Field.Add(new T_Field("青少年焦虑", "", 7, 2));
             
            //db.T_Field.Add(new T_Field("强迫", "", 8, 2));
            //db.T_Field.Add(new T_Field("失眠问题", "", 8, 2));
            //db.T_Field.Add(new T_Field("成瘾问题", "", 8, 2));
            //db.T_Field.Add(new T_Field("进食困难", "", 8, 2));
            //db.T_Field.Add(new T_Field("心理创伤", "", 8, 2));
            //db.T_Field.Add(new T_Field("依恋问题", "", 8, 2));
            //db.T_Field.Add(new T_Field("拖延", "", 8, 2));
            

            //科室
            db.T_Department.Add(new T_Department(1, 0, "内科"));//1
            db.T_Department.Add(new T_Department(1, 0, "外科"));//2
            db.T_Department.Add(new T_Department(1, 0, "妇产科"));//3
            db.T_Department.Add(new T_Department(1, 0, "儿科"));//4
            db.T_Department.Add(new T_Department(1, 0, "五官科"));//5
            db.T_Department.Add(new T_Department(1, 0, "肿瘤科"));//6
            db.T_Department.Add(new T_Department(1, 0, "皮肤性病科"));//7
            db.T_Department.Add(new T_Department(1, 0, "中医科"));//8
            db.T_Department.Add(new T_Department(1, 0, "传染科"));//9
            db.T_Department.Add(new T_Department(1, 0, "精神心理科"));//10
            db.T_Department.Add(new T_Department(1, 0, "麻醉医学科"));//11
            db.T_Department.Add(new T_Department(1, 0, "医学影像科"));//12
            db.T_Department.Add(new T_Department(1, 0, "其它科室"));//13
            db.T_Department.Add(new T_Department(1, 0, "整形美容科"));//14
            db.T_Department.Add(new T_Department(1, 0, "营养科"));//15
            db.T_Department.Add(new T_Department(1, 0, "生殖中心"));//16
            db.T_Department.Add(new T_Department(1, 0, "药剂科"));//17

            db.T_Department.Add(new T_Department(2, 1, "呼吸内科"));
            db.T_Department.Add(new T_Department(2, 1, "消化内科"));
            db.T_Department.Add(new T_Department(2, 1, "神经内科"));
            db.T_Department.Add(new T_Department(2, 1, "心血管内科"));
            db.T_Department.Add(new T_Department(2, 1, "肾内科"));
            db.T_Department.Add(new T_Department(2, 1, "血液内科"));
            db.T_Department.Add(new T_Department(2, 1, "免疫科"));
            db.T_Department.Add(new T_Department(2, 1, "内分泌科"));
            db.T_Department.Add(new T_Department(2, 2, "普通外科"));
            db.T_Department.Add(new T_Department(2, 2, "神经外科"));
            db.T_Department.Add(new T_Department(2, 2, "心胸外科"));
            db.T_Department.Add(new T_Department(2, 2, "泌尿外科"));
            db.T_Department.Add(new T_Department(2, 2, "心血管外科"));
            db.T_Department.Add(new T_Department(2, 2, "乳腺外科"));
            db.T_Department.Add(new T_Department(2, 2, "肝胆外科"));
            db.T_Department.Add(new T_Department(2, 2, "器官移植"));
            db.T_Department.Add(new T_Department(2, 2, "肛肠外科"));
            db.T_Department.Add(new T_Department(2, 2, "烧伤科"));
            db.T_Department.Add(new T_Department(2, 2, "骨外科"));
            db.T_Department.Add(new T_Department(2, 3, "妇科"));
            db.T_Department.Add(new T_Department(2, 3, "产科"));
            db.T_Department.Add(new T_Department(2, 3, "计划生育"));
            db.T_Department.Add(new T_Department(2, 3, "妇幼保健"));

            db.T_Department.Add(new T_Department(2, 4, "儿科综合"));
            db.T_Department.Add(new T_Department(2, 4, "小儿内科"));
            db.T_Department.Add(new T_Department(2, 4, "小儿外科"));
            db.T_Department.Add(new T_Department(2, 4, "新生儿科"));
            db.T_Department.Add(new T_Department(2, 4, "儿童营养保健科"));

            db.T_Department.Add(new T_Department(2, 5, "耳鼻喉科"));
            db.T_Department.Add(new T_Department(2, 5, "眼科"));
            db.T_Department.Add(new T_Department(2, 5, "口腔科"));

            db.T_Department.Add(new T_Department(2, 6, "肿瘤内科"));
            db.T_Department.Add(new T_Department(2, 6, "肿瘤外科"));
            db.T_Department.Add(new T_Department(2, 6, "肿瘤妇科"));
            db.T_Department.Add(new T_Department(2, 6, "骨肿瘤科"));
            db.T_Department.Add(new T_Department(2, 6, "放疗科"));
            db.T_Department.Add(new T_Department(2, 6, "肿瘤康复科"));
            db.T_Department.Add(new T_Department(2, 6, "肿瘤综合科"));

            db.T_Department.Add(new T_Department(2, 7, "皮肤科"));
            db.T_Department.Add(new T_Department(2, 7, "性病科"));

            db.T_Department.Add(new T_Department(2, 8, "中医全科"));
            db.T_Department.Add(new T_Department(2, 8, "中医内科"));
            db.T_Department.Add(new T_Department(2, 8, "中医外科"));
            db.T_Department.Add(new T_Department(2, 8, "中医妇科"));
            db.T_Department.Add(new T_Department(2, 8, "中医儿科"));
            db.T_Department.Add(new T_Department(2, 8, "中医保健科"));
            db.T_Department.Add(new T_Department(2, 8, "针灸按摩科"));
            db.T_Department.Add(new T_Department(2, 8, "中医骨伤科"));
            db.T_Department.Add(new T_Department(2, 8, "中医肿瘤科"));

            db.T_Department.Add(new T_Department(2, 9, "肝病科"));
            db.T_Department.Add(new T_Department(2, 9, "艾滋病科"));
            db.T_Department.Add(new T_Department(2, 9, "结核病"));
            db.T_Department.Add(new T_Department(2, 9, "寄生虫"));

            db.T_Department.Add(new T_Department(2, 10, "精神科"));
            db.T_Department.Add(new T_Department(2, 10, "心理咨询科"));

            db.T_Department.Add(new T_Department(2, 11, "麻醉科"));
            db.T_Department.Add(new T_Department(2, 11, "疼痛科"));

            db.T_Department.Add(new T_Department(2, 12, "核医学科"));
            db.T_Department.Add(new T_Department(2, 12, "放射科"));
            db.T_Department.Add(new T_Department(2, 12, "超声科"));

            db.T_Department.Add(new T_Department(2, 13, "药剂科"));
            db.T_Department.Add(new T_Department(2, 13, "护理科"));
            db.T_Department.Add(new T_Department(2, 13, "体检科"));
            db.T_Department.Add(new T_Department(2, 13, "检验科"));
            db.T_Department.Add(new T_Department(2, 13, "急诊科"));
            db.T_Department.Add(new T_Department(2, 13, "公共卫生与预防科"));
            db.T_Department.Add(new T_Department(2, 13, "全科"));
            db.T_Department.Add(new T_Department(2, 13, "设备科"));

            db.T_Department.Add(new T_Department(2, 14, "整形美容科"));
            db.T_Department.Add(new T_Department(2, 15, "营养科"));
            db.T_Department.Add(new T_Department(2, 16, "生殖中心"));

            db.T_Department.Add(new T_Department(2, 17, "药剂科"));//17

            db.T_Hospital.Add(new T_Hospital("上海交通大学医学院附属瑞金医院", "上海市黄浦区瑞金二路197号", "三甲", "血液病学、内分泌与代谢病学、心血管病学、神经病学", "(021)34186000,(021)64312806"));
            db.T_Hospital.Add(new T_Hospital("上海交通大学医学院附属第九人民医院", "上海市黄浦区制造局路639号", "三甲", "", "(021)23271699"));
            db.T_Hospital.Add(new T_Hospital("上海交通大学医学院附属仁济医院", "上海市黄浦区山东中路145号", "三甲", "", "(021)58752345"));
            db.T_Hospital.Add(new T_Hospital("上海交通大学附属第六人民医院", "上海市徐汇区宜山路600号", "三甲", "", "(021)64369181"));
            db.T_Hospital.Add(new T_Hospital("上海交通大学医学院附属新华医院", "上海市杨浦区控江路1665号", "三甲", "", "(021)25078999"));
            db.T_Hospital.Add(new T_Hospital("上海交通大学附属第一人民医院", "上海市虹口区武进路85号", "三甲", "", "(021)63240090"));
            db.T_Hospital.Add(new T_Hospital("上海交通大学医学院附属上海市精神卫生中心", "上海市徐汇区宛平南路600号", "三甲", "", "(021)64387250"));
            db.T_Hospital.Add(new T_Hospital("上海交通大学医学院附属国际和平妇幼保健院", "上海市徐汇区华山路1961号", "三甲", "", ""));
            db.T_Hospital.Add(new T_Hospital("上海交通大学附属胸科医院", "上海市徐汇区淮海西路241号", "三甲", "", "(021)22200000,(021)62821990"));
            db.T_Hospital.Add(new T_Hospital("上海交通大学医学院附属上海儿童医学中心", "上海市浦东新区东方路1678号", "三甲", "", "(021)38626161"));
            db.T_Hospital.Add(new T_Hospital("上海交通大学附属儿童医院", "上海市浦东新区东方路1678号", "三甲", "", "(021)38626161"));
            db.T_Hospital.Add(new T_Hospital("上海交通大学医学院附属同仁医院", "上海市长宁区仙霞路1111号", "三甲", "", "(021)52039999"));
            db.T_Hospital.Add(new T_Hospital("上海交通大学医学院附属苏州九龙医院", "苏州市苏州工业园区万盛街118号", "三甲", "", "(0512)62629999"));

            //地区
            //一级
            db.T_Area.Add(new T_Area(1, 0, "北京市"));//1
            db.T_Area.Add(new T_Area(1, 0, "天津市"));//2
            db.T_Area.Add(new T_Area(1, 0, "河北省"));//3
            db.T_Area.Add(new T_Area(1, 0, "山西省"));//4
            db.T_Area.Add(new T_Area(1, 0, "内蒙古"));//5
            db.T_Area.Add(new T_Area(1, 0, "辽宁省"));//6
            db.T_Area.Add(new T_Area(1, 0, "吉林省"));//7
            db.T_Area.Add(new T_Area(1, 0, "黑龙江省"));//8
            db.T_Area.Add(new T_Area(1, 0, "上海市"));//9
            db.T_Area.Add(new T_Area(1, 0, "江苏省"));//10
            db.T_Area.Add(new T_Area(1, 0, "浙江省"));//11
            db.T_Area.Add(new T_Area(1, 0, "安徽省"));//12
            db.T_Area.Add(new T_Area(1, 0, "福建省"));//13
            db.T_Area.Add(new T_Area(1, 0, "江西省"));//14
            db.T_Area.Add(new T_Area(1, 0, "山东省"));//15
            db.T_Area.Add(new T_Area(1, 0, "河南省"));//16
            db.T_Area.Add(new T_Area(1, 0, "湖北省"));//17
            db.T_Area.Add(new T_Area(1, 0, "湖南省"));//18
            db.T_Area.Add(new T_Area(1, 0, "广东省"));//19
            db.T_Area.Add(new T_Area(1, 0, "广西省"));//20
            db.T_Area.Add(new T_Area(1, 0, "海南省"));//21
            db.T_Area.Add(new T_Area(1, 0, "重庆市"));//22
            db.T_Area.Add(new T_Area(1, 0, "四川省"));//23
            db.T_Area.Add(new T_Area(1, 0, "贵州省"));//24
            db.T_Area.Add(new T_Area(1, 0, "云南省"));//25
            db.T_Area.Add(new T_Area(1, 0, "西藏自治区"));//26
            db.T_Area.Add(new T_Area(1, 0, "陕西省"));//27
            db.T_Area.Add(new T_Area(1, 0, "甘肃省"));//28
            db.T_Area.Add(new T_Area(1, 0, "青海省"));//29
            db.T_Area.Add(new T_Area(1, 0, "宁夏省"));//30
            db.T_Area.Add(new T_Area(1, 0, "新疆维吾尔自治区"));//31
            //二级
            #region 北京市
            db.T_Area.Add(new T_Area(2, 1, "北京市"));  //32
            #endregion
            #region 天津市
            db.T_Area.Add(new T_Area(2, 2, "天津市"));//33
            #endregion
            #region 河北省
            db.T_Area.Add(new T_Area(2, 3, "石家庄市"));  //34
            db.T_Area.Add(new T_Area(2, 3, "唐山市"));  //35
            db.T_Area.Add(new T_Area(2, 3, "秦皇岛市"));  //36
            db.T_Area.Add(new T_Area(2, 3, "邯郸市"));  //37
            db.T_Area.Add(new T_Area(2, 3, "邢台市"));  //38
            db.T_Area.Add(new T_Area(2, 3, "保定市"));  //39
            db.T_Area.Add(new T_Area(2, 3, "张家口市"));  //40
            db.T_Area.Add(new T_Area(2, 3, "承德市"));  //41
            db.T_Area.Add(new T_Area(2, 3, "沧州市"));  //42
            db.T_Area.Add(new T_Area(2, 3, "廊坊市"));  //43
            db.T_Area.Add(new T_Area(2, 3, "衡水市"));  //44
            db.T_Area.Add(new T_Area(2, 3, "定州市"));  //45
            db.T_Area.Add(new T_Area(2, 3, "辛集市"));  //46
            #endregion
            #region 山西省
            db.T_Area.Add(new T_Area(2, 4, "太原市"));  //47
            db.T_Area.Add(new T_Area(2, 4, "大同市"));  //48
            db.T_Area.Add(new T_Area(2, 4, "阳泉市"));  //49
            db.T_Area.Add(new T_Area(2, 4, "长治市"));  //50
            db.T_Area.Add(new T_Area(2, 4, "晋城市"));  //51
            db.T_Area.Add(new T_Area(2, 4, "朔州市"));  //52
            db.T_Area.Add(new T_Area(2, 4, "晋中市"));  //53
            db.T_Area.Add(new T_Area(2, 4, "运城市"));  //54
            db.T_Area.Add(new T_Area(2, 4, "忻州市"));  //55
            db.T_Area.Add(new T_Area(2, 4, "临汾市"));  //56
            db.T_Area.Add(new T_Area(2, 4, "吕梁市"));  //57
            #endregion
            #region 内蒙古
            db.T_Area.Add(new T_Area(2, 5, "呼和浩特市"));  //58
            db.T_Area.Add(new T_Area(2, 5, "包头市"));  //59
            db.T_Area.Add(new T_Area(2, 5, "乌海市"));  //60
            db.T_Area.Add(new T_Area(2, 5, "赤峰市"));  //61
            db.T_Area.Add(new T_Area(2, 5, "通辽市"));  //62
            db.T_Area.Add(new T_Area(2, 5, "鄂尔多斯市"));  //63
            db.T_Area.Add(new T_Area(2, 5, "呼伦贝尔市"));  //64
            db.T_Area.Add(new T_Area(2, 5, "巴彦淖尔市"));  //65
            db.T_Area.Add(new T_Area(2, 5, "乌兰察布市"));  //66
            db.T_Area.Add(new T_Area(2, 5, "兴安盟"));  //67
            db.T_Area.Add(new T_Area(2, 5, "锡林郭勒盟"));  //68
            db.T_Area.Add(new T_Area(2, 5, "阿拉善盟"));  //69
            #endregion
            #region 辽宁省
            db.T_Area.Add(new T_Area(2, 6, "沈阳"));  //70
            db.T_Area.Add(new T_Area(2, 6, "大连"));  //71
            db.T_Area.Add(new T_Area(2, 6, "鞍山"));  //72
            db.T_Area.Add(new T_Area(2, 6, "抚顺"));  //73
            db.T_Area.Add(new T_Area(2, 6, "本溪"));  //74
            db.T_Area.Add(new T_Area(2, 6, "丹东"));  //75
            db.T_Area.Add(new T_Area(2, 6, "锦州"));  //76
            db.T_Area.Add(new T_Area(2, 6, "营口"));  //77
            db.T_Area.Add(new T_Area(2, 6, "阜新"));  //78
            db.T_Area.Add(new T_Area(2, 6, "辽阳"));  //79
            db.T_Area.Add(new T_Area(2, 6, "盘锦"));  //80
            db.T_Area.Add(new T_Area(2, 6, "铁岭"));  //81
            db.T_Area.Add(new T_Area(2, 6, "朝阳"));  //82
            db.T_Area.Add(new T_Area(2, 6, "葫芦岛"));  //83
            #endregion
            #region 吉林省
            db.T_Area.Add(new T_Area(2, 7, "长春市"));  //84
            db.T_Area.Add(new T_Area(2, 7, "吉林市"));  //85
            db.T_Area.Add(new T_Area(2, 7, "四平市"));  //86
            db.T_Area.Add(new T_Area(2, 7, "辽源市"));  //87
            db.T_Area.Add(new T_Area(2, 7, "通化市"));  //88
            db.T_Area.Add(new T_Area(2, 7, "白山市"));  //89
            db.T_Area.Add(new T_Area(2, 7, "白城市"));  //90
            db.T_Area.Add(new T_Area(2, 7, "松原市"));  //91
            db.T_Area.Add(new T_Area(2, 7, "延边朝鲜族自治州"));  //92
            db.T_Area.Add(new T_Area(2, 7, "吉林省长白山保护开发区"));  //93
            db.T_Area.Add(new T_Area(2, 7, "梅河口"));  //94
            db.T_Area.Add(new T_Area(2, 7, "公主岭"));  //95
            #endregion
            #region 黑龙江省
            db.T_Area.Add(new T_Area(2, 8, "哈尔滨市"));  //96
            db.T_Area.Add(new T_Area(2, 8, "齐齐哈尔市"));  //97
            db.T_Area.Add(new T_Area(2, 8, "鸡西市"));  //98
            db.T_Area.Add(new T_Area(2, 8, "鹤岗市"));  //99
            db.T_Area.Add(new T_Area(2, 8, "双鸭山市"));  //100
            db.T_Area.Add(new T_Area(2, 8, "大庆市"));  //101
            db.T_Area.Add(new T_Area(2, 8, "伊春市"));  //102
            db.T_Area.Add(new T_Area(2, 8, "佳木斯市"));  //103
            db.T_Area.Add(new T_Area(2, 8, "七台河市"));  //104
            db.T_Area.Add(new T_Area(2, 8, "牡丹江市"));  //105
            db.T_Area.Add(new T_Area(2, 8, "黑河市"));  //106
            db.T_Area.Add(new T_Area(2, 8, "绥化市"));  //107
            db.T_Area.Add(new T_Area(2, 8, "大兴安岭地区"));  //108
            #endregion
            #region 上海市
            db.T_Area.Add(new T_Area(2, 9, "上海市"));  //109
            #endregion
            #region 江苏省
            db.T_Area.Add(new T_Area(2, 10, "南京"));  //110
            db.T_Area.Add(new T_Area(2, 10, "无锡"));  //111
            db.T_Area.Add(new T_Area(2, 10, "徐州"));  //112
            db.T_Area.Add(new T_Area(2, 10, "常州"));  //113
            db.T_Area.Add(new T_Area(2, 10, "苏州"));  //114
            db.T_Area.Add(new T_Area(2, 10, "南通"));  //115
            db.T_Area.Add(new T_Area(2, 10, "连云港"));  //116
            db.T_Area.Add(new T_Area(2, 10, "淮安"));  //117
            db.T_Area.Add(new T_Area(2, 10, "盐城"));  //118
            db.T_Area.Add(new T_Area(2, 10, "扬州"));  //119
            db.T_Area.Add(new T_Area(2, 10, "镇江"));  //120
            db.T_Area.Add(new T_Area(2, 10, "泰州"));  //121
            db.T_Area.Add(new T_Area(2, 10, "宿迁"));  //122
            #endregion
            #region 浙江省
            db.T_Area.Add(new T_Area(2, 11, "杭州"));  //123
            db.T_Area.Add(new T_Area(2, 11, "宁波"));  //124
            db.T_Area.Add(new T_Area(2, 11, "温州"));  //125
            db.T_Area.Add(new T_Area(2, 11, "绍兴"));  //126
            db.T_Area.Add(new T_Area(2, 11, "湖州"));  //127
            db.T_Area.Add(new T_Area(2, 11, "嘉兴"));  //128
            db.T_Area.Add(new T_Area(2, 11, "金华"));  //129
            db.T_Area.Add(new T_Area(2, 11, "衢州"));  //130
            db.T_Area.Add(new T_Area(2, 11, "台州"));  //131
            db.T_Area.Add(new T_Area(2, 11, "丽水"));  //132
            db.T_Area.Add(new T_Area(2, 11, "舟山"));  //133
            #endregion
            #region 安徽省
            db.T_Area.Add(new T_Area(2, 12, "合肥"));  //134
            db.T_Area.Add(new T_Area(2, 12, "芜湖"));  //135
            db.T_Area.Add(new T_Area(2, 12, "蚌埠"));  //136
            db.T_Area.Add(new T_Area(2, 12, "淮南"));  //137
            db.T_Area.Add(new T_Area(2, 12, "马鞍山"));  //138
            db.T_Area.Add(new T_Area(2, 12, "淮北"));  //139
            db.T_Area.Add(new T_Area(2, 12, "铜陵"));  //140
            db.T_Area.Add(new T_Area(2, 12, "安庆"));  //141
            db.T_Area.Add(new T_Area(2, 12, "黄山"));  //142
            db.T_Area.Add(new T_Area(2, 12, "阜阳"));  //143
            db.T_Area.Add(new T_Area(2, 12, "宿州"));  //145
            db.T_Area.Add(new T_Area(2, 12, "滁州"));  //146
            db.T_Area.Add(new T_Area(2, 12, "六安"));  //147
            db.T_Area.Add(new T_Area(2, 12, "宣城"));  //148
            db.T_Area.Add(new T_Area(2, 12, "池州"));  //149
            db.T_Area.Add(new T_Area(2, 12, "亳州"));  //150
            #endregion
            #region 福建省
            db.T_Area.Add(new T_Area(2, 13, "福州"));  //151
            db.T_Area.Add(new T_Area(2, 13, "厦门"));  //152
            db.T_Area.Add(new T_Area(2, 13, "漳州"));  //153
            db.T_Area.Add(new T_Area(2, 13, "泉州"));  //154
            db.T_Area.Add(new T_Area(2, 13, "三明"));  //155
            db.T_Area.Add(new T_Area(2, 13, "莆田"));  //156
            db.T_Area.Add(new T_Area(2, 13, "南平"));  //157
            db.T_Area.Add(new T_Area(2, 13, "龙岩"));  //158
            db.T_Area.Add(new T_Area(2, 13, "宁德"));  //159
            db.T_Area.Add(new T_Area(2, 13, "平潭"));  //160
            #endregion
            #region 江西省
            db.T_Area.Add(new T_Area(2, 14, "南昌"));  //161
            db.T_Area.Add(new T_Area(2, 14, "九江"));  //162
            db.T_Area.Add(new T_Area(2, 14, "上饶"));  //163
            db.T_Area.Add(new T_Area(2, 14, "抚州"));  //164
            db.T_Area.Add(new T_Area(2, 14, "宜春"));  //165
            db.T_Area.Add(new T_Area(2, 14, "吉安"));  //166
            db.T_Area.Add(new T_Area(2, 14, "赣州"));  //167
            db.T_Area.Add(new T_Area(2, 14, "景德镇"));  //168
            db.T_Area.Add(new T_Area(2, 14, "萍乡"));  //169
            db.T_Area.Add(new T_Area(2, 14, "新余"));  //170
            db.T_Area.Add(new T_Area(2, 14, "鹰潭"));  //171
            #endregion
            #region 山东省
            db.T_Area.Add(new T_Area(2, 15, "济南"));  //172
            db.T_Area.Add(new T_Area(2, 15, "青岛"));  //173
            db.T_Area.Add(new T_Area(2, 15, "淄博"));  //174
            db.T_Area.Add(new T_Area(2, 15, "枣庄"));  //175
            db.T_Area.Add(new T_Area(2, 15, "东营"));  //176
            db.T_Area.Add(new T_Area(2, 15, "烟台"));  //177
            db.T_Area.Add(new T_Area(2, 15, "潍坊"));  //178
            db.T_Area.Add(new T_Area(2, 15, "济宁"));  //179
            db.T_Area.Add(new T_Area(2, 15, "泰安"));  //180
            db.T_Area.Add(new T_Area(2, 15, "威海"));  //181
            db.T_Area.Add(new T_Area(2, 15, "日照"));  //182
            db.T_Area.Add(new T_Area(2, 15, "滨州"));  //183
            db.T_Area.Add(new T_Area(2, 15, "德州"));  //184
            db.T_Area.Add(new T_Area(2, 15, "聊城"));  //185
            db.T_Area.Add(new T_Area(2, 15, "临沂"));  //186
            db.T_Area.Add(new T_Area(2, 15, "菏泽"));  //187
            db.T_Area.Add(new T_Area(2, 15, "莱芜"));  //188
            #endregion
            #region 河南省
            db.T_Area.Add(new T_Area(2, 16, "郑州市"));  //189
            db.T_Area.Add(new T_Area(2, 16, "开封市"));  //190
            db.T_Area.Add(new T_Area(2, 16, "洛阳市"));  //191
            db.T_Area.Add(new T_Area(2, 16, "平顶山市"));  //192
            db.T_Area.Add(new T_Area(2, 16, "安阳市"));  //193
            db.T_Area.Add(new T_Area(2, 16, "鹤壁市"));  //194
            db.T_Area.Add(new T_Area(2, 16, "新乡市"));  //195
            db.T_Area.Add(new T_Area(2, 16, "焦作市"));  //196
            db.T_Area.Add(new T_Area(2, 16, "濮阳市"));  //197
            db.T_Area.Add(new T_Area(2, 16, "许昌市"));  //198
            db.T_Area.Add(new T_Area(2, 16, "漯河市"));  //199
            db.T_Area.Add(new T_Area(2, 16, "三门峡市"));  //200
            db.T_Area.Add(new T_Area(2, 16, "商丘市"));  //201
            db.T_Area.Add(new T_Area(2, 16, "周口市"));  //202
            db.T_Area.Add(new T_Area(2, 16, "驻马店市"));  //203
            db.T_Area.Add(new T_Area(2, 16, "南阳市"));  //204
            db.T_Area.Add(new T_Area(2, 16, "信阳市"));  //205
            db.T_Area.Add(new T_Area(2, 16, "济源市"));  //206
            #endregion
            #region 湖北省
            db.T_Area.Add(new T_Area(2, 17, "武汉市"));  //207
            db.T_Area.Add(new T_Area(2, 17, "黄石市"));  //208
            db.T_Area.Add(new T_Area(2, 17, "十堰市"));  //209
            db.T_Area.Add(new T_Area(2, 17, "宜昌市"));  //210
            db.T_Area.Add(new T_Area(2, 17, "襄阳市"));  //211
            db.T_Area.Add(new T_Area(2, 17, "鄂州市"));  //212
            db.T_Area.Add(new T_Area(2, 17, "荆门市"));  //213
            db.T_Area.Add(new T_Area(2, 17, "孝感市"));  //214
            db.T_Area.Add(new T_Area(2, 17, "荆州市"));  //215
            db.T_Area.Add(new T_Area(2, 17, "黄冈市"));  //216
            db.T_Area.Add(new T_Area(2, 17, "咸宁市"));  //217
            db.T_Area.Add(new T_Area(2, 17, "随州市"));  //218
            db.T_Area.Add(new T_Area(2, 17, "恩施土家族苗族自治州"));  //219
            db.T_Area.Add(new T_Area(2, 17, "仙桃市"));  //220
            db.T_Area.Add(new T_Area(2, 17, "潜江市"));  //221
            db.T_Area.Add(new T_Area(2, 17, "天门市"));  //222
            db.T_Area.Add(new T_Area(2, 17, "神农架林区"));  //223
            #endregion
            #region 湖南省
            db.T_Area.Add(new T_Area(2, 18, "长沙市"));  //224
            db.T_Area.Add(new T_Area(2, 18, "株洲市"));  //225
            db.T_Area.Add(new T_Area(2, 18, "湘潭市"));  //226
            db.T_Area.Add(new T_Area(2, 18, "衡阳市"));  //227
            db.T_Area.Add(new T_Area(2, 18, "邵阳市"));  //228
            db.T_Area.Add(new T_Area(2, 18, "岳阳市"));  //229
            db.T_Area.Add(new T_Area(2, 18, "常德市"));  //230
            db.T_Area.Add(new T_Area(2, 18, "张家界市"));  //231
            db.T_Area.Add(new T_Area(2, 18, "益阳市"));  //232
            db.T_Area.Add(new T_Area(2, 18, "娄底市"));  //233
            db.T_Area.Add(new T_Area(2, 18, "郴州市"));  //234
            db.T_Area.Add(new T_Area(2, 18, "永州市"));  //235
            db.T_Area.Add(new T_Area(2, 18, "怀化市"));  //236
            db.T_Area.Add(new T_Area(2, 18, "湘西土家族苗族自治州"));  //237
            #endregion
            #region 广东省
            db.T_Area.Add(new T_Area(2, 19, "广州市"));  //238
            db.T_Area.Add(new T_Area(2, 19, "深圳市"));  //239
            db.T_Area.Add(new T_Area(2, 19, "珠海市"));  //240
            db.T_Area.Add(new T_Area(2, 19, "汕头市"));  //241
            db.T_Area.Add(new T_Area(2, 19, "佛山市"));  //342
            db.T_Area.Add(new T_Area(2, 19, "韶关市"));  //243
            db.T_Area.Add(new T_Area(2, 19, "湛江市"));  //244
            db.T_Area.Add(new T_Area(2, 19, "肇庆市"));  //245
            db.T_Area.Add(new T_Area(2, 19, "江门市"));  //246
            db.T_Area.Add(new T_Area(2, 19, "茂名市"));  //247
            db.T_Area.Add(new T_Area(2, 19, "惠州市"));  //248
            db.T_Area.Add(new T_Area(2, 19, "梅州市"));  //249
            db.T_Area.Add(new T_Area(2, 19, "汕尾市"));  //250
            db.T_Area.Add(new T_Area(2, 19, "河源市"));  //251
            db.T_Area.Add(new T_Area(2, 19, "阳江市"));  //252
            db.T_Area.Add(new T_Area(2, 19, "清远市"));  //253
            db.T_Area.Add(new T_Area(2, 19, "东莞市"));  //254
            db.T_Area.Add(new T_Area(2, 19, "中山市"));  //255
            db.T_Area.Add(new T_Area(2, 19, "潮州市"));  //256
            db.T_Area.Add(new T_Area(2, 19, "揭阳市"));  //257
            db.T_Area.Add(new T_Area(2, 19, "云浮市"));  //258
            #endregion
            #region 广西省
            db.T_Area.Add(new T_Area(2, 20, "南宁市"));  //259
            db.T_Area.Add(new T_Area(2, 20, "柳州市"));  //260
            db.T_Area.Add(new T_Area(2, 20, "桂林市"));  //261
            db.T_Area.Add(new T_Area(2, 20, "梧州市"));  //262
            db.T_Area.Add(new T_Area(2, 20, "北海市"));  //263
            db.T_Area.Add(new T_Area(2, 20, "防城港市"));  //264
            db.T_Area.Add(new T_Area(2, 20, "钦州市"));  //265
            db.T_Area.Add(new T_Area(2, 20, "贵港市"));  //266
            db.T_Area.Add(new T_Area(2, 20, "玉林市"));  //267
            db.T_Area.Add(new T_Area(2, 20, "百色市"));  //268
            db.T_Area.Add(new T_Area(2, 20, "贺州市"));  //269
            db.T_Area.Add(new T_Area(2, 20, "河池市"));  //270
            db.T_Area.Add(new T_Area(2, 20, "来宾市"));  //271
            db.T_Area.Add(new T_Area(2, 20, "崇左市"));  //272
            #endregion
            #region 海南省
            db.T_Area.Add(new T_Area(2, 21, "海口市"));  //273
            db.T_Area.Add(new T_Area(2, 21, "三亚市"));  //274
            db.T_Area.Add(new T_Area(2, 21, "三沙市"));  //275
            db.T_Area.Add(new T_Area(2, 21, "儋州市"));  //276
            db.T_Area.Add(new T_Area(2, 21, "县级市"));  //277
            db.T_Area.Add(new T_Area(2, 21, "县"));  //278
            db.T_Area.Add(new T_Area(2, 21, "自治县"));  //279
            db.T_Area.Add(new T_Area(2, 21, "开发区"));  //280
            #endregion
            #region 重庆市
            db.T_Area.Add(new T_Area(2, 22, "重庆市"));  //281
            #endregion
            #region 四川省
            db.T_Area.Add(new T_Area(2, 23, "成都市"));  //282
            db.T_Area.Add(new T_Area(2, 23, "绵阳市"));  //283
            db.T_Area.Add(new T_Area(2, 23, "自贡市"));  //284
            db.T_Area.Add(new T_Area(2, 23, "攀枝花市"));//285
            db.T_Area.Add(new T_Area(2, 23, "泸州市"));  //286
            db.T_Area.Add(new T_Area(2, 23, "德阳市"));  //287
            db.T_Area.Add(new T_Area(2, 23, "广元市"));  //288
            db.T_Area.Add(new T_Area(2, 23, "遂宁市"));  //289
            db.T_Area.Add(new T_Area(2, 23, "内江市"));  //290
            db.T_Area.Add(new T_Area(2, 23, "乐山市"));  //291
            db.T_Area.Add(new T_Area(2, 23, "资阳市"));  //292
            db.T_Area.Add(new T_Area(2, 23, "宜宾市"));  //293
            db.T_Area.Add(new T_Area(2, 23, "南充市"));  //294
            db.T_Area.Add(new T_Area(2, 23, "达州市"));  //295
            db.T_Area.Add(new T_Area(2, 23, "雅安市"));  //296
            db.T_Area.Add(new T_Area(2, 23, "阿坝藏族羌族自治州"));  //297
            db.T_Area.Add(new T_Area(2, 23, "甘孜藏族自治州"));  //298
            db.T_Area.Add(new T_Area(2, 23, "凉山彝族自治州"));  //299
            db.T_Area.Add(new T_Area(2, 23, "广安市"));  //300
            db.T_Area.Add(new T_Area(2, 23, "巴中市"));  //301
            db.T_Area.Add(new T_Area(2, 23, "眉山市"));  //302
            #endregion
            #region 贵州省
            db.T_Area.Add(new T_Area(2, 24, "贵阳市"));  //303
            db.T_Area.Add(new T_Area(2, 24, "遵义市"));  //304
            db.T_Area.Add(new T_Area(2, 24, "六盘水市"));//305
            db.T_Area.Add(new T_Area(2, 24, "安顺市"));  //306
            db.T_Area.Add(new T_Area(2, 24, "铜仁市"));  //307
            db.T_Area.Add(new T_Area(2, 24, "毕节市"));  //308
            db.T_Area.Add(new T_Area(2, 24, "黔西南布依族苗族自治州"));  //309
            db.T_Area.Add(new T_Area(2, 24, "黔东南苗族侗族自治州"));  //310
            db.T_Area.Add(new T_Area(2, 24, "黔南布依族苗族自治州"));  //311
            db.T_Area.Add(new T_Area(2, 24, "省直管试点县"));  //312
            #endregion
            #region 云南省
            db.T_Area.Add(new T_Area(2, 25, "昆明市"));  //313
            db.T_Area.Add(new T_Area(2, 25, "曲靖市"));  //314
            db.T_Area.Add(new T_Area(2, 25, "玉溪市"));  //315
            db.T_Area.Add(new T_Area(2, 25, "昭通市"));  //316
            db.T_Area.Add(new T_Area(2, 25, "保山市"));  //317
            db.T_Area.Add(new T_Area(2, 25, "丽江市"));  //318
            db.T_Area.Add(new T_Area(2, 25, "普洱市"));  //319
            db.T_Area.Add(new T_Area(2, 25, "临沧市"));  //320
            db.T_Area.Add(new T_Area(2, 25, "德宏傣族景颇族自治州"));  //321
            db.T_Area.Add(new T_Area(2, 25, "怒江傈僳族自治州"));  //322
            db.T_Area.Add(new T_Area(2, 25, "迪庆藏族自治州"));  //323
            db.T_Area.Add(new T_Area(2, 25, "大理白族自治州"));  //324
            db.T_Area.Add(new T_Area(2, 25, "楚雄彝族自治州"));  //325
            db.T_Area.Add(new T_Area(2, 25, "红河哈尼族彝族自治州"));  //326
            db.T_Area.Add(new T_Area(2, 25, "文山壮族苗族自治州"));  //327
            db.T_Area.Add(new T_Area(2, 25, "西双版纳傣族自治州"));  //328
            #endregion
            #region 西藏自治区
            db.T_Area.Add(new T_Area(2, 26, "拉萨市"));  //329
            db.T_Area.Add(new T_Area(2, 26, "昌都市"));  //330
            db.T_Area.Add(new T_Area(2, 26, "日喀则市"));//331
            db.T_Area.Add(new T_Area(2, 26, "林芝市"));  //332
            db.T_Area.Add(new T_Area(2, 26, "山南市"));  //333
            db.T_Area.Add(new T_Area(2, 26, "那曲地区"));//334
            db.T_Area.Add(new T_Area(2, 26, "阿里地区"));//335
            #endregion
            #region 陕西省
            db.T_Area.Add(new T_Area(2, 27, "西安市"));  //336
            db.T_Area.Add(new T_Area(2, 27, "宝鸡市"));  //337
            db.T_Area.Add(new T_Area(2, 27, "咸阳市"));  //338
            db.T_Area.Add(new T_Area(2, 27, "渭南市"));  //339
            db.T_Area.Add(new T_Area(2, 27, "铜川市"));  //340
            db.T_Area.Add(new T_Area(2, 27, "延安市"));  //341
            db.T_Area.Add(new T_Area(2, 27, "榆林市"));  //342
            db.T_Area.Add(new T_Area(2, 27, "安康市"));  //343
            db.T_Area.Add(new T_Area(2, 27, "汉中市"));  //344
            db.T_Area.Add(new T_Area(2, 27, "商洛市"));  //345
            db.T_Area.Add(new T_Area(2, 27, "杨凌示范区"));  //346
            #endregion
            #region 甘肃省
            db.T_Area.Add(new T_Area(2, 28, "兰州市"));  //347
            db.T_Area.Add(new T_Area(2, 28, "嘉峪关市"));//348
            db.T_Area.Add(new T_Area(2, 28, "金昌市"));  //349
            db.T_Area.Add(new T_Area(2, 28, "白银市"));  //350
            db.T_Area.Add(new T_Area(2, 28, "天水市"));  //351
            db.T_Area.Add(new T_Area(2, 28, "酒泉市"));  //352
            db.T_Area.Add(new T_Area(2, 28, "张掖市"));  //353
            db.T_Area.Add(new T_Area(2, 28, "武威市"));  //354
            db.T_Area.Add(new T_Area(2, 28, "定西市"));  //355
            db.T_Area.Add(new T_Area(2, 28, "陇南市"));  //356
            db.T_Area.Add(new T_Area(2, 28, "平凉市"));  //357
            db.T_Area.Add(new T_Area(2, 28, "庆阳市"));  //358
            db.T_Area.Add(new T_Area(2, 28, "临夏回族自治州"));  //359
            db.T_Area.Add(new T_Area(2, 28, "甘南藏族自治州"));  //360
            #endregion
            #region 青海省
            db.T_Area.Add(new T_Area(2, 29, "西宁市"));  //361
            db.T_Area.Add(new T_Area(2, 29, "海东市"));  //362
            db.T_Area.Add(new T_Area(2, 29, "海北藏族自治州"));  //363
            db.T_Area.Add(new T_Area(2, 29, "黄南藏族自治州"));  //364
            db.T_Area.Add(new T_Area(2, 29, "海南藏族自治州"));  //365
            db.T_Area.Add(new T_Area(2, 29, "果洛藏族自治州"));  //366
            db.T_Area.Add(new T_Area(2, 29, "玉树藏族自治州"));  //367
            db.T_Area.Add(new T_Area(2, 29, "海西蒙古族藏族自治州"));  //368
            #endregion
            #region 宁夏省
            db.T_Area.Add(new T_Area(2, 30, "银川市"));  //369
            db.T_Area.Add(new T_Area(2, 30, "石嘴山市"));//370
            db.T_Area.Add(new T_Area(2, 30, "吴忠市"));  //371
            db.T_Area.Add(new T_Area(2, 30, "固原市"));  //372
            db.T_Area.Add(new T_Area(2, 30, "中卫市"));  //373
            #endregion
            #region 新疆维吾尔自治区
            db.T_Area.Add(new T_Area(2, 31, "乌鲁木齐市"));  //374
            db.T_Area.Add(new T_Area(2, 31, "克拉玛依市"));  //375
            db.T_Area.Add(new T_Area(2, 31, "吐鲁番市"));  //376
            db.T_Area.Add(new T_Area(2, 31, "哈密市"));  //377
            db.T_Area.Add(new T_Area(2, 31, "阿克苏地区"));  //378
            db.T_Area.Add(new T_Area(2, 31, "喀什地区"));  //379
            db.T_Area.Add(new T_Area(2, 31, "和田地区"));  //380
            db.T_Area.Add(new T_Area(2, 31, "昌吉回族自治州"));  //381
            db.T_Area.Add(new T_Area(2, 31, "博尔塔拉蒙古自治州"));  //382
            db.T_Area.Add(new T_Area(2, 31, "巴音郭楞蒙古自治州"));  //383
            db.T_Area.Add(new T_Area(2, 31, "克孜勒苏柯尔克孜自治州"));  //384
            db.T_Area.Add(new T_Area(2, 31, "伊犁哈萨克自治州"));  //385
            db.T_Area.Add(new T_Area(2, 31, "直辖县级市"));  //386
            #endregion

            db.SaveChanges();

            base.Seed(db);
        }
    }
}