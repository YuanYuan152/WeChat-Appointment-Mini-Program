<template>

  <view class="page-admin-roles">

    <view class="header">

      <text class="title">角色&权限绑定</text>

      <text class="subtitle">每个账号仅拥有一个角色。管理员 &gt; 咨询主任 &gt; 咨询助理，高级别可赋权/管理低级别，同级不可互相操作</text>

    </view>



    <view class="toolbar">

      <view class="search-bar">

        <input
          v-model="keyword"
          class="search-input"
          type="text"
          placeholder="搜索用户 ID、姓名、手机号或咨询师名"
          confirm-type="search"
          @confirm="reloadUsers"
        />
      </view>
      <view class="search-btn" @tap="reloadUsers">搜索</view>
      <view class="add-btn" @tap="openAddModal">+ 添加用户</view>
    </view>

    <view v-if="loading" class="empty">加载中...</view>
    <view v-else-if="users.length === 0" class="empty">
      {{ keyword.trim() ? '未找到匹配用户' : '暂无用户数据' }}
    </view>
    <view v-else class="list">
      <view v-for="u in users" :key="u.id" class="card" :class="{ legacy: u.isLegacyOnly }">
        <view class="card-head">
          <view class="head-main">
            <text class="name">{{ u.displayName || u.nickname || u.mobile || '未命名用户' }}</text>
            <text class="uid">
              {{ u.isLegacyOnly ? `旧系统 ID ${u.legacyDoctorId}` : `ID ${u.id}` }}{{ u.mobile ? ' · ' + u.mobile : '' }}
            </text>
            <text v-if="showPatientSourceMeta(u)" class="meta-line">来访来源：{{ u.patientSourceLabel }}</text>
            <text v-if="showCounselorTypeMeta(u)" class="meta-line">咨询师类型：{{ u.counselorTypeLabel }}</text>
            <text v-if="u.createdAt" class="meta-line">注册时间：{{ formatCreatedAt(u.createdAt) }}</text>
          </view>
          <text v-if="u.isLegacyOnly" class="legacy-tag">旧系统 · 待绑定</text>
          <text v-else-if="u.activeRole || u.roles?.length" class="active-tag">当前：{{ currentRoleDisplayLabel(u) }}</text>
        </view>

        <view v-if="u.isLegacyOnly" class="legacy-actions">
          <text class="legacy-tip">该咨询师仅在旧系统中，请通过手机号添加为系统用户后绑定角色。</text>
          <view class="legacy-bind-btn" @tap="openAddFromLegacy(u)">添加并绑定</view>
        </view>

        <template v-else>
        <view
          v-if="u.roles?.length && u.id !== currentUserId && canManageUser(u)"
          class="delete-user-btn"
          @tap="deleteUser(u)"
        >
          删除用户
        </view>
        <view v-else-if="u.roles?.length && u.id !== currentUserId && !canManageUser(u)" class="readonly-hint">
          您无权管理该账号（同级或更高级别）
        </view>

        <view class="section-label">当前角色</view>
        <view v-if="userRole(u)" class="roles">
          <view class="role-chip role-chip-base">
            <text class="role-text">{{ currentRoleDisplayLabel(u) }}</text>
          </view>
        </view>
        <text v-else class="no-role">暂未设置角色</text>

        <view v-if="canManageUser(u)" class="bind-row">
          <picker
            :range="assignableRoleLabels"
            :value="pickerIndex(u.id)"
            @change="e => selectRole(u.id, Number(e.detail.value))"
          >
            <view class="picker-row">
              <text class="picker-text">{{ selectedLabel(u.id) }}</text>
              <text class="picker-arrow">▾</text>
            </view>
          </picker>
          <view class="bind-btn" @tap="changeRole(u.id)">更换类型</view>
        </view>
        <text v-else-if="userRole(u)" class="readonly-hint">当前账号超出您的赋权范围，无法更换角色</text>
        </template>
      </view>
    </view>

    <view v-if="!loading && hasMore" class="load-more" @tap="loadMore">加载更多（{{ users.length }}/{{ total }}）</view>

    <view class="footer-tip">
      列表包含全部系统账号及尚未迁移的旧系统咨询师。搜索支持 ID、手机号、昵称与咨询师档案姓名。
    </view>



    <view v-if="showAddModal" class="modal-overlay" @touchmove.stop.prevent>

      <view class="modal-card" @tap.stop @touchmove.stop.prevent>

        <text class="modal-title">添加用户</text>

        <text class="modal-sub">通过手机号创建或查找用户，并绑定角色与权限</text>



        <view class="form-group form-group--input" @tap.stop>
          <text class="form-label">手机号 *</text>

          <input
            v-model="addForm.mobile"
            class="form-input"
            placeholder-class="form-input-ph"
            type="number"
            maxlength="11"
            placeholder="11 位手机号"
          />

        </view>



        <view class="form-group">

          <text class="form-label">角色 *</text>

          <picker

            :range="assignableRoleLabels"

            :value="addForm.roleIndex"

            @change="e => addForm.roleIndex = Number(e.detail.value)"

          >

            <view class="picker-row modal-picker">

              <text class="picker-text">{{ assignableRoleLabels[addForm.roleIndex] || '选择角色' }}</text>

              <text class="picker-arrow">▾</text>

            </view>

          </picker>

        </view>



        <view v-if="addSelectedRole === 'Patient'" class="form-group">
          <text class="form-label">来访来源 *</text>
          <picker
            :range="patientSourceLabels"
            :value="addForm.patientSourceIndex"
            @change="e => addForm.patientSourceIndex = Number(e.detail.value)"
          >
            <view class="picker-row modal-picker">
              <text class="picker-text">{{ patientSourceLabels[addForm.patientSourceIndex] || '请选择来源' }}</text>
              <text class="picker-arrow">▾</text>
            </view>
          </picker>
        </view>



        <view v-if="addSelectedRole === 'Counselor'" class="form-group">
          <text class="form-label">咨询师类型 *</text>
          <picker
            :range="counselorTypeLabels"
            :value="addForm.counselorTypeIndex"
            @change="e => addForm.counselorTypeIndex = Number(e.detail.value)"
          >
            <view class="picker-row modal-picker">
              <text class="picker-text">{{ counselorTypeLabels[addForm.counselorTypeIndex] || '请选择类型' }}</text>
              <text class="picker-arrow">▾</text>
            </view>
          </picker>
        </view>



        <view class="form-group form-group--input" @tap.stop>
          <text class="form-label">用户名（选填）</text>

          <input
            v-model="addForm.nickname"
            class="form-input"
            placeholder-class="form-input-ph"
            type="text"
            maxlength="20"
            placeholder="请输入用户名，不填则自动生成"
          />

        </view>



        <view class="modal-btns">

          <button class="modal-btn cancel" @tap.stop="showAddModal = false">取消</button>

          <button class="modal-btn confirm" :loading="adding" @tap.stop="submitAddUser">确认添加</button>

        </view>

      </view>

    </view>

  </view>

</template>



<script setup lang="ts">

import { computed, onMounted, reactive, ref } from 'vue'

import { onShow } from '@dcloudio/uni-app'

import { httpV2 } from '@/utils/http'

import { API_ENDPOINTS } from '@/config/api'

import { ROLE_OPTIONS, roleLabel, resolveAccountRole, assignableRolesForActor, canActorManageUser, canActorAssignRole } from '@/constants/roles'
import {
  COUNSELOR_TYPE_OPTIONS,
  PATIENT_SOURCE_OPTIONS,
  counselorTypeLabel,
  isCharityPatientSource,
} from '@/constants/userRoleMeta'
import { useUserStore } from '@/store/user'

interface AdminUser {
  id: number
  nickname?: string
  mobile?: string
  displayName?: string
  counselorName?: string
  activeRole?: string
  activeRoleLabel?: string
  roles?: string[]
  patientSource?: string
  patientSourceLabel?: string
  counselorType?: string
  counselorTypeLabel?: string
  createdAt?: string
  isSelfRegistered?: boolean
  isLegacyOnly?: boolean
  legacyDoctorId?: number
}

interface AdminUsersResponse {
  items: AdminUser[]
  total: number
  page: number
  pageSize: number
}

const roleValues = ROLE_OPTIONS.map(r => r.value)

const actorRole = computed(() =>
  resolveAccountRole(userStore.roles, userStore.activeRole || userStore.userInfo?.activeRole),
)

const assignableRoleValues = computed(() =>
  assignableRolesForActor(actorRole.value, roleValues),
)

const assignableRoleLabels = computed(() =>
  assignableRoleValues.value.map(v => roleLabel(v)),
)

const roleLabels = ROLE_OPTIONS.map(r => r.label)
const patientSourceLabels = PATIENT_SOURCE_OPTIONS.map(o => o.label)
const counselorTypeLabels = COUNSELOR_TYPE_OPTIONS.map(o => o.label)

const userStore = useUserStore()
const currentUserId = computed(() => userStore.userId)
const addSelectedRole = computed(() => assignableRoleValues.value[addForm.roleIndex] || assignableRoleValues.value[0])

const users = ref<AdminUser[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const keyword = ref('')
const total = ref(0)
const page = ref(1)
const pageSize = 100

const hasMore = computed(() => users.value.length < total.value)

const selected = reactive<Record<number, string>>({})

const showAddModal = ref(false)

const adding = ref(false)

const addForm = reactive({
  mobile: '',
  roleIndex: 0,
  nickname: '',
  patientSourceIndex: 0,
  counselorTypeIndex: 0,
})



const reloadUsers = () => {
  page.value = 1
  load(true)
}

const loadMore = () => {
  if (!hasMore.value || loadingMore.value) return
  page.value += 1
  load(false)
}

const load = async (reset = true) => {
  if (reset) {
    page.value = 1
    loading.value = true
  } else {
    loadingMore.value = true
  }

  if (!userStore.userInfo) {
    try {
      await userStore.fetchUserInfo()
    } catch {
      // ignore
    }
  }

  try {
    const params: Record<string, string | number> = {
      page: page.value,
      page_size: pageSize,
    }
    const q = keyword.value.trim()
    if (q) params.keyword = q

    const res = await httpV2.get<AdminUsersResponse>(
      API_ENDPOINTS.admin.users,
      params,
      { showLoading: false },
    )

    if (res.code === 0 && res.data) {
      total.value = res.data.total || 0
      const next = res.data.items || []
      users.value = reset ? next : [...users.value, ...next]
      initSelectedFromUsers()
    } else if (reset) {
      users.value = []
      total.value = 0
      uni.showToast({ title: res.msg || '加载失败', icon: 'none' })
    }
  } catch {
    if (reset) {
      users.value = []
      total.value = 0
    }
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const canManageUser = (user: AdminUser) => {
  const targetRole = userRole(user)
  if (!targetRole) return true
  return canActorManageUser(actorRole.value, targetRole)
}

const pickerIndex = (uid: number) => {

  const val = selected[uid]

  if (!val) return 0

  const idx = assignableRoleValues.value.indexOf(val as typeof roleValues[number])

  return idx >= 0 ? idx : 0

}



const selectedLabel = (uid: number) => {
  const val = selected[uid]
  if (val) return roleLabel(val)
  const user = users.value.find(u => u.id === uid)
  if (user && userRole(user)) return currentRoleDisplayLabel(user)
  return '选择角色'
}



const formatDateTime = (value: string) => {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const formatCreatedAt = (value?: string) => {
  if (!value) return ''
  return formatDateTime(value)
}

/** 管理列表展示当前唯一角色 */
const userRole = (user: AdminUser) =>
  resolveAccountRole(user.roles, user.activeRole)

const currentRoleDisplayLabel = (user: AdminUser) => {
  if (user.activeRoleLabel) return user.activeRoleLabel
  const role = userRole(user)
  if (role === 'Counselor') {
    return user.counselorTypeLabel || counselorTypeLabel(user.counselorType) || roleLabel('Counselor')
  }
  if (role === 'Patient' && isCharityPatientSource(user.patientSource)) {
    return user.patientSourceLabel || '公益来访'
  }
  return roleLabel(role)
}

/** 仅当前角色为来访时展示来源 */
const showPatientSourceMeta = (user: AdminUser) =>
  userRole(user) === 'Patient' && !!user.patientSourceLabel

/** 仅当前角色为咨询师时展示类型 */
const showCounselorTypeMeta = (user: AdminUser) =>
  userRole(user) === 'Counselor' && !!user.counselorTypeLabel

const initSelectedFromUsers = () => {
  for (const u of users.value) {
    const role = userRole(u)
    if (role) selected[u.id] = role
  }
}

const pickPatientSource = (): Promise<string | null> =>
  new Promise((resolve) => {
    uni.showActionSheet({
      itemList: patientSourceLabels,
      success: (res) => {
        resolve(PATIENT_SOURCE_OPTIONS[res.tapIndex]?.value ?? null)
      },
      fail: () => resolve(null),
    })
  })

const pickCounselorType = (): Promise<string | null> =>
  new Promise((resolve) => {
    uni.showActionSheet({
      itemList: counselorTypeLabels,
      success: (res) => {
        resolve(COUNSELOR_TYPE_OPTIONS[res.tapIndex]?.value ?? null)
      },
      fail: () => resolve(null),
    })
  })

const openAddFromLegacy = (user: AdminUser) => {
  addForm.mobile = (user.mobile || '').replace(/\D/g, '')
  addForm.nickname = user.displayName || user.nickname || ''
  addForm.roleIndex = Math.max(0, assignableRoleValues.value.indexOf('Counselor'))
  addForm.patientSourceIndex = 0
  addForm.counselorTypeIndex = 0
  showAddModal.value = true
}

const openAddModal = () => {
  if (!assignableRoleValues.value.length) {
    uni.showToast({ title: '当前角色无可赋权选项', icon: 'none' })
    return
  }
  addForm.mobile = ''
  addForm.roleIndex = 0
  addForm.nickname = ''
  addForm.patientSourceIndex = 0
  addForm.counselorTypeIndex = 0
  showAddModal.value = true
}



const submitAddUser = async () => {

  const mobile = addForm.mobile.trim().replace(/\D/g, '')

  if (!/^1\d{10}$/.test(mobile)) {

    uni.showToast({ title: '请输入有效的11位手机号', icon: 'none' })

    return

  }

  const role = assignableRoleValues.value[addForm.roleIndex]
  if (!role) {
    uni.showToast({ title: '请选择角色', icon: 'none' })
    return
  }

  const nickname = addForm.nickname.trim()

  if (role === 'Patient') {
    const patientSource = PATIENT_SOURCE_OPTIONS[addForm.patientSourceIndex]?.value
    if (!patientSource) {
      uni.showToast({ title: '请选择来访来源', icon: 'none' })
      return
    }
  } else if (role === 'Counselor') {
    const counselorType = COUNSELOR_TYPE_OPTIONS[addForm.counselorTypeIndex]?.value
    if (!counselorType) {
      uni.showToast({ title: '请选择咨询师类型', icon: 'none' })
      return
    }
  }

  adding.value = true
  try {
    const payload: {
      mobile: string
      role: string
      nickname?: string
      patient_source?: string
      counselor_type?: string
    } = { mobile, role }

    if (nickname) payload.nickname = nickname

    if (role === 'Patient') {
      payload.patient_source = PATIENT_SOURCE_OPTIONS[addForm.patientSourceIndex]!.value
    } else if (role === 'Counselor') {
      payload.counselor_type = COUNSELOR_TYPE_OPTIONS[addForm.counselorTypeIndex]!.value
    }



    const res = await httpV2.post<AdminUser & { message?: string; created?: boolean }>(

      API_ENDPOINTS.admin.createUserByMobile,

      payload,

    )

    if (res.code === 0) {

      showAddModal.value = false

      await load(true)

      const msg = res.data?.message || (res.data?.created ? '用户已添加' : '已绑定角色')

      uni.showToast({ title: msg, icon: 'success' })

      if (res.data?.mobile) {

        keyword.value = res.data.mobile

      }

    } else {

      uni.showToast({ title: res.msg || '添加失败', icon: 'none' })

    }

  } catch {

    uni.showToast({ title: '添加失败', icon: 'none' })

  } finally {

    adding.value = false

  }

}



const selectRole = (uid: number, idx: number) => {

  selected[uid] = assignableRoleValues.value[idx] || assignableRoleValues.value[0]

}



const ROLES_WITH_TYPE = new Set(['Patient', 'Counselor'])

const changeRole = async (uid: number) => {
  const role = selected[uid]
  if (!role) {
    uni.showToast({ title: '请选择角色', icon: 'none' })
    return
  }

  const user = users.value.find(u => u.id === uid)
  if (user && !canManageUser(user)) {
    uni.showToast({ title: '无权管理该账号', icon: 'none' })
    return
  }
  if (!canActorAssignRole(actorRole.value, role)) {
    uni.showToast({ title: '无权赋权该角色', icon: 'none' })
    return
  }
  const current = user ? userRole(user) : ''
  if (current && current === role && !ROLES_WITH_TYPE.has(role)) {
    uni.showModal({
      title: '提示',
      content: '当前角色暂不支持修改类型',
      showCancel: false,
    })
    return
  }
  if (current && current !== role) {
    const confirmed = await new Promise<boolean>((resolve) => {
      uni.showModal({
        title: '确认更换角色',
        content: `将「${roleLabel(current)}」更换为「${roleLabel(role)}」？用户需重新登录后生效。`,
        success: (res) => resolve(!!res.confirm),
      })
    })
    if (!confirmed) return
  }

  const payload: { role: string; counselor_type?: string; patient_source?: string } = { role }
  if (role === 'Patient') {
    const patientSource = await pickPatientSource()
    if (!patientSource) return
    payload.patient_source = patientSource
  } else if (role === 'Counselor') {
    const counselorType = await pickCounselorType()
    if (!counselorType) return
    payload.counselor_type = counselorType
  }

  const res = await httpV2.post(API_ENDPOINTS.admin.bindRole(uid), payload)

  if (res.code === 0) {
    delete selected[uid]
    await load(true)
    uni.showToast({ title: (res.data as { message?: string })?.message || res.msg || '已更换', icon: 'success' })
  } else {
    uni.showToast({ title: res.msg || res.data?.message || '更换失败', icon: 'none' })
  }
}

const deleteUser = (user: AdminUser) => {
  const name = user.nickname || user.mobile || `用户 ${user.id}`
  uni.showModal({
    title: '确认删除用户',
    content: `确定永久删除「${name}」吗？\n\n该操作不可恢复，账号及角色绑定将从系统中彻底移除。若该用户存在咨询记录或已支付订单，将无法删除。`,
    confirmText: '删除',
    confirmColor: '#B91C1C',
    success: async (res) => {
      if (!res.confirm) return
      const del = await httpV2.delete(API_ENDPOINTS.admin.deleteUser(user.id))
      if (del.code === 0) {
        delete selected[user.id]
        await load(true)
        uni.showToast({ title: del.data?.message || '已删除用户', icon: 'success' })
      } else {
        uni.showToast({ title: del.msg || '删除失败', icon: 'none' })
      }
    },
  })
}

onMounted(() => load(true))

onShow(() => load(true))

</script>



<style scoped>

.page-admin-roles {

  min-height: 100vh;

  background: #F7F5F2;

  padding: 32rpx;

  padding-bottom: 48rpx;

  box-sizing: border-box;

}



.header {

  background: linear-gradient(135deg, #3D5A4E, #2F4A40);

  border-radius: 24rpx;

  padding: 40rpx 32rpx;

  margin-bottom: 24rpx;

  box-shadow: 0 8rpx 32rpx rgba(61, 90, 78, 0.15);

}



.title {

  display: block;

  font-size: 36rpx;

  font-weight: 600;

  color: #fff;

  letter-spacing: 1rpx;

}



.subtitle {

  display: block;

  margin-top: 10rpx;

  font-size: 24rpx;

  color: rgba(255, 255, 255, 0.82);

  line-height: 1.6;

}



.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-bottom: 24rpx;
  align-items: center;
}

.search-bar {
  flex: 1;
  min-width: 200rpx;
}

.search-btn {
  flex-shrink: 0;
  box-sizing: border-box;
  height: 88rpx;
  line-height: 88rpx;
  padding: 0 28rpx;
  background: #E8E4DE;
  color: #3D5A4E;
  border-radius: 16rpx;
  font-size: 28rpx;
  font-weight: 600;
  white-space: nowrap;
}

.load-more {
  text-align: center;
  padding: 28rpx;
  font-size: 28rpx;
  color: #3D5A4E;
  font-weight: 600;
}

.card.legacy {
  border: 1rpx dashed #D4CFC6;
  background: #FFFCF7;
}

.legacy-tag {
  font-size: 22rpx;
  color: #B45309;
  background: #FEF3C7;
  padding: 6rpx 16rpx;
  border-radius: 100rpx;
}

.legacy-actions {
  margin-top: 16rpx;
}

.legacy-tip {
  display: block;
  font-size: 24rpx;
  color: #9CA3AF;
  line-height: 1.5;
  margin-bottom: 16rpx;
}

.legacy-bind-btn {
  display: inline-block;
  font-size: 26rpx;
  color: #fff;
  background: #3D5A4E;
  padding: 16rpx 32rpx;
  border-radius: 100rpx;
  font-weight: 600;
}

.list-tabs {
  display: flex;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.list-tab {
  flex: 1;
  text-align: center;
  padding: 18rpx 0;
  border-radius: 16rpx;
  font-size: 28rpx;
  color: #6B7280;
  background: #fff;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.03);
}

.list-tab.active {
  color: #fff;
  background: #3D5A4E;
  font-weight: 600;
}

.card.revoked {
  border: 1rpx solid #F3DADA;
  background: #FFFBFB;
}

.revoked-tag {
  flex-shrink: 0;
  font-size: 22rpx;
  font-weight: 600;
  color: #B91C1C;
  background: #FEE2E2;
  padding: 8rpx 18rpx;
  border-radius: 100rpx;
}

.revoked-tip {
  display: block;
  margin-top: 20rpx;
  font-size: 24rpx;
  color: #9CA3AF;
  line-height: 1.6;
}



.search-input {
  width: 100%;
  box-sizing: border-box;
  display: block;
  height: 88rpx;
  min-height: 88rpx;
  line-height: 88rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: #2C2C2C;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.03);
}

.add-btn {
  flex-shrink: 0;
  box-sizing: border-box;
  height: 88rpx;
  line-height: 88rpx;
  padding: 0 28rpx;
  background: #3D5A4E;
  color: #fff;
  border-radius: 16rpx;
  text-align: center;
  font-size: 28rpx;
  font-weight: 600;
  white-space: nowrap;
  box-shadow: 0 4rpx 16rpx rgba(61, 90, 78, 0.2);
}



.empty {

  text-align: center;

  padding: 80rpx 0;

  color: #9CA3AF;

  font-size: 28rpx;

}



.card {

  background: #fff;

  border-radius: 20rpx;

  padding: 28rpx;

  margin-bottom: 20rpx;

  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.03);

}



.card-head {

  display: flex;

  justify-content: space-between;

  align-items: flex-start;

  gap: 16rpx;

}



.head-main {

  flex: 1;

  min-width: 0;

}



.name {

  display: block;

  font-size: 30rpx;

  font-weight: 600;

  color: #2C2C2C;

}



.uid {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: #9CA3AF;
}

.meta-line {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: #6B7280;
}



.active-tag {
  flex-shrink: 0;
  font-size: 22rpx;
  font-weight: 600;
  color: #3D5A4E;
  background: #E8E4DE;
  padding: 8rpx 18rpx;
  border-radius: 100rpx;
}

.delete-user-btn {
  margin-top: 16rpx;
  align-self: flex-start;
  font-size: 24rpx;
  color: #B91C1C;
  padding: 8rpx 0;
}

.readonly-hint {
  margin-top: 16rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #9CA3AF;
}



.section-label {

  margin-top: 24rpx;

  margin-bottom: 12rpx;

  font-size: 24rpx;

  color: #8A8A8A;

}



.roles {

  display: flex;

  flex-wrap: wrap;

  gap: 12rpx;

}



.role-chip {

  display: inline-flex;

  align-items: center;

  gap: 8rpx;

  padding: 10rpx 18rpx;

  border-radius: 100rpx;

  background: #E8E4DE;

  border: 1rpx solid #D4CFC6;

}

.role-chip-base {
  background: #F0EDE8;
  border-color: #E8E4DE;
}



.role-text {

  font-size: 24rpx;

  color: #3D5A4E;

  font-weight: 600;

}

.role-chip-base .role-text {
  color: #6B9080;
  font-weight: 500;
}



.role-remove {

  font-size: 28rpx;

  color: #6B9080;

  line-height: 1;

}



.no-role {

  display: block;

  font-size: 26rpx;

  color: #9CA3AF;

}



.bind-row {

  display: flex;

  gap: 16rpx;

  margin-top: 24rpx;

  align-items: stretch;

}



.picker-row {

  flex: 1;

  display: flex;

  align-items: center;

  justify-content: space-between;

  background: #F7F5F2;

  border-radius: 16rpx;

  padding: 20rpx 24rpx;

  border: 1rpx solid #E8E4DE;

}



.picker-text {

  font-size: 28rpx;

  color: #374151;

}



.picker-arrow {

  font-size: 24rpx;

  color: #9CA3AF;

}



.bind-btn {

  flex-shrink: 0;

  background: #3D5A4E;

  color: #fff;

  border-radius: 16rpx;

  padding: 0 32rpx;

  line-height: 80rpx;

  font-size: 28rpx;

  font-weight: 600;

}



.bind-row picker {

  flex: 1;

}



.footer-tip {

  margin-top: 12rpx;

  padding: 24rpx;

  border-radius: 16rpx;

  background: #E8E4DE;

  color: #3D5A4E;

  font-size: 22rpx;

  line-height: 1.6;

  text-align: center;

}



.modal-overlay {

  position: fixed;

  inset: 0;

  background: rgba(0, 0, 0, 0.45);

  z-index: 1000;

  display: flex;

  align-items: center;

  justify-content: center;

  padding: 32rpx;

  box-sizing: border-box;

}



.modal-card {

  width: 100%;

  max-width: 640rpx;

  background: #fff;

  border-radius: 24rpx;

  padding: 40rpx 32rpx;

  box-sizing: border-box;

}



.modal-title {

  display: block;

  font-size: 34rpx;

  font-weight: 700;

  color: #2C2C2C;

}



.modal-sub {

  display: block;

  margin-top: 8rpx;

  margin-bottom: 32rpx;

  font-size: 24rpx;

  color: #9CA3AF;

  line-height: 1.5;

}



.form-group {
  margin-bottom: 24rpx;
}

.form-group--input {
  position: relative;
  z-index: 2;
}



.form-label {

  display: block;

  margin-bottom: 12rpx;

  font-size: 26rpx;

  color: #6B7280;

  font-weight: 600;

}



.form-input {
  width: 100%;
  box-sizing: border-box;
  display: block;
  height: 88rpx;
  min-height: 88rpx;
  line-height: 88rpx;
  background: #F7F5F2;
  border-radius: 16rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: #2C2C2C;
  border: 1rpx solid #E8E4DE;
}

.form-input-ph {
  color: #9CA3AF;
  font-size: 28rpx;
  line-height: 88rpx;
}



.modal-picker {
  width: 100%;
  box-sizing: border-box;
  min-height: 88rpx;
  height: 88rpx;
}



.modal-btns {

  display: flex;

  gap: 20rpx;

  margin-top: 36rpx;

}



.modal-btn {

  flex: 1;

  height: 88rpx;

  line-height: 88rpx;

  border-radius: 100rpx;

  font-size: 28rpx;

  font-weight: 600;

  margin: 0;

}



.modal-btn::after {

  border: none;

}



.modal-btn.cancel {

  background: #F3F4F6;

  color: #6B7280;

}



.modal-btn.confirm {

  background: #3D5A4E;

  color: #fff;

}

</style>


