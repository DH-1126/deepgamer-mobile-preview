import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { HomePage } from '../pages/HomePage'
import { SearchPage } from '../pages/SearchPage'
import { GameZonePage } from '../pages/GameZonePage'
import { GameSelectPage } from '../pages/GameSelectPage'
import { ProductDetailPage } from '../pages/ProductDetailPage'
import { ProfilePage } from '../pages/ProfilePage'
import { FavoritesPage } from '../pages/FavoritesPage'
import { MessagePage } from '../pages/MessagePage'
import { GroupChatPage } from '../pages/GroupChatPage'
import { ForgotPasswordPage, LoginPage, PrivacyPolicyPage, PushPermissionPage, SmsHelpPage, UserAgreementPage, WelcomePage } from '../pages/AuthPage'
import { AuthPromptProvider, RequireAuth } from '../components/AuthAccess'
import { OrderCheckoutPage, OrderDetailPage, OrderListPage, PaymentCancelPage, PaymentSuccessPage } from '../pages/OrderPages'
import { RecycleOrderListPage } from '../pages/RecycleOrderListPage'
import { AppraisalDetailPage, AppraisalFillPage, AppraisalLoadingPage, AppraisalPage, SellGoodsPage, SellPage } from '../pages/SellPages'
import { FulfillmentContractPage } from '../pages/FulfillmentContractPage'
import { WalletOverviewPage, WalletWithdrawPage } from '../pages/WalletPages'
import {
  AboutUsPage,
  AccountCancellationPage,
  AccountSettingsPage,
  AccountSecurityPage,
  PasswordSettingsPage,
  PrivacyAgreementCenterPage,
  ThirdPartyBindingsPage,
} from '../pages/ProfileSettingsPages'
import { BusinessSellerContractPage, PersonalSellerContractPage, SellerCenterPage } from '../pages/SellerContractPages'
import { RealNamePage } from '../pages/RealNamePage'
import { ProfileIdentityPage, PhoneSettingsPage } from '../pages/ProfileIdentityPages'
import { AfterSaleApplyPage, AfterSaleDetailPage, AfterSalesPage } from '../pages/AfterSalesPage'
import { FeedbackPage } from '../pages/FeedbackPage'
import { FootprintPage } from '../pages/FootprintPage'
import { ReminderPage } from '../pages/ReminderPage'
import { NotificationCenterPage, NotificationSettingsPage } from '../pages/NotificationPages'
import { authRepository } from '../repository/authRepository'
import { SUPPORT_CONVERSATION_ID, SUPPORT_CONVERSATION_ROUTE } from '../data/messageFixtures'
import type { AuthMethod } from '../types/auth'
import { getLinkedConnection, linkedChannel, useLinkedState } from '../linked/linkedData'
import { isLinkedDataMode, isRestoredLinkedMode } from '../runtime/dataMode'
import { RestoredClientProvider, RestoredConnectionBoundary } from '../linked/RestoredClientProvider'
import { LinkedGoodsListPage, LinkedGoodsPublishPage } from '../pages/LinkedGoodsPages'
import { Heading, Spinner, SurfaceCard } from '../components/ui'
import { RestoredRecycleOwnerRequestPage, RestoredRecycleRequestPage } from '../pages/RestoredRecycleRequestPages'
import { RestoredOrderDetailPage, RestoredOrderListPage } from '../pages/RestoredOrderPages'
import { RestoredCatalogPage, RestoredCheckoutPage, RestoredPaymentPage } from '../pages/RestoredPurchasePages'

const ComponentLibraryPage = lazy(() => import('../pages/ComponentLibraryPage').then(module => ({ default: module.ComponentLibraryPage })))
const RestoredGoodsListPage = lazy(() => import('../pages/RestoredGoodsPages').then(module => ({ default: module.RestoredGoodsListPage })))
const RestoredGoodsPublishPage = lazy(() => import('../pages/RestoredGoodsPages').then(module => ({ default: module.RestoredGoodsPublishPage })))
const RestoredMessageListPage = lazy(() => import('../pages/RestoredMessagePages').then(module => ({ default: module.RestoredMessageListPage })))
const RestoredConversationPage = lazy(() => import('../pages/RestoredMessagePages').then(module => ({ default: module.RestoredConversationPage })))
const RestoredRecycleConsultationPage = lazy(() => import('../pages/RestoredRecyclePages').then(module => ({ default: module.RestoredRecycleConsultationPage })))

function MessageAlias() {
  const { search, hash } = useLocation()
  return <Navigate to={`/message${search}${hash}`} replace />
}

function ProtectedApp() {
  return <RequireAuth><Outlet /></RequireAuth>
}

function ConversationEntry() {
  const { conversationId } = useParams()
  // 登录遇到问题时仍能咨询官方客服；交易群继续要求登录。
  return conversationId === SUPPORT_CONVERSATION_ID
    ? <GroupChatPage />
    : <RequireAuth><GroupChatPage /></RequireAuth>
}

function LinkedFeatureUnavailable({ feature }: { feature: string }) {
  return <main className="linked-connection-state"><SurfaceCard><Heading as="h1" variant="result">{feature}暂未接入联动</Heading><p>首批联动范围仅包含游戏启停、卖家认证、商品发布审核与上下架。</p><small>本页不会创建独立模拟记录，也不会发送业务 API 请求。</small><p><a href={`${import.meta.env.BASE_URL}`}>返回联动用户端首页</a></p></SurfaceCard></main>
}

function LaunchedApp() {
  const location = useLocation()
  if (isLinkedDataMode || authRepository.hasCompletedLaunch()) return <Outlet />
  const returnTo = `${location.pathname}${location.search}${location.hash}`
  return <Navigate to={`/welcome?returnTo=${encodeURIComponent(returnTo)}`} replace state={{ returnTo }} />
}

function LoginEntry({ method }: { method: AuthMethod }) {
  const location = useLocation()
  if (authRepository.hasCompletedLaunch()) return <LoginPage key={method} method={method} />
  const loginParams = new URLSearchParams(location.search)
  const welcomeParams = new URLSearchParams({ returnTo: loginParams.get('returnTo') ?? '/', loginMethod: method })
  const closeTo = loginParams.get('closeTo')
  if (closeTo) welcomeParams.set('closeTo', closeTo)
  return <Navigate to={`/welcome?${welcomeParams.toString()}`} replace />
}

export function App() {
  return isRestoredLinkedMode ? <RestoredClientProvider><RestoredConnectionBoundary><RestoredApp /></RestoredConnectionBoundary></RestoredClientProvider> : <PrototypeApp />
}

/** Pending modules stay explicit; never render a prototype record as this actor's data. */
function RestoredApp() {
  return <div className="mobile-shell"><AuthPromptProvider><Suspense fallback={<main className="app-route-loading" role="status"><Spinner decorative />正在加载页面…</main>}><Routes>
    <Route path="/" element={<Navigate to="/profile" replace />} />
    <Route path="/profile" element={<ProfilePage />} />
    <Route path="/seller" element={<SellerCenterPage />} />
    <Route path="/seller/center" element={<SellerCenterPage />} />
    <Route path="/sell" element={<SellerCenterPage />} />
    <Route path="/seller/apply/personal" element={<PersonalSellerContractPage />} />
    <Route path="/seller/apply/business" element={<BusinessSellerContractPage />} />
    <Route path="/publish" element={<RestoredGoodsPublishPage />} />
    <Route path="/linked/publish" element={<RestoredGoodsPublishPage />} />
    <Route path="/my-goods" element={<RestoredGoodsListPage />} />
    <Route path="/linked/my-goods" element={<RestoredGoodsListPage />} />
    <Route path="/recycle" element={<RestoredRecycleRequestPage />} />
    <Route path="/recycle/requests/:requestId" element={<RestoredRecycleOwnerRequestPage />} />
    <Route path="/recycle/consultations/:consultationId" element={<RestoredRecycleConsultationPage />} />
    <Route path="/game" element={<Navigate to="/buy" replace />} />
    <Route path="/buy" element={<RestoredCatalogPage />} />
    <Route path="/buy/confirm" element={<RestoredCheckoutPage />} />
    <Route path="/orders" element={<RestoredOrderListPage />} />
    <Route path="/orders/:orderId/payment" element={<RestoredPaymentPage />} />
    <Route path="/orders/:orderId" element={<RestoredOrderDetailPage />} />
    <Route path="/message" element={<RestoredMessageListPage />} />
    <Route path="/messages" element={<MessageAlias />} />
    <Route path="/im/:conversationId" element={<RestoredConversationPage />} />
    <Route path="/message/groups/:conversationId" element={<RestoredConversationPage />} />
    <Route path="/component-library" element={<ComponentLibraryPage />} />
    <Route path="/login/*" element={<Navigate to="/profile" replace />} />
    <Route path="/welcome" element={<Navigate to="/profile" replace />} />
    <Route path="*" element={<main className="linked-connection-state"><SurfaceCard><Heading as="h1" variant="result">此功能尚在接入联动</Heading><p>当前阶段开放卖家认证、模拟签署、本人商品管理与成员消息。其余模块未验收，不会使用原型数据代替。</p><a href={`${import.meta.env.BASE_URL}profile`}>返回个人中心</a></SurfaceCard></main>} />
  </Routes></Suspense></AuthPromptProvider></div>
}

function PrototypeApp() {
  const linkedState = useLinkedState()
  useEffect(() => {
    const releasePointerFocus = (event: PointerEvent) => {
      const target = event.target instanceof Element
        ? event.target.closest<HTMLElement>('button, a[href], [role="button"], [tabindex]:not([tabindex="-1"])')
        : null
      if (!target) return
      window.requestAnimationFrame(() => target.blur())
    }
    document.addEventListener('pointerup', releasePointerFocus)
    return () => document.removeEventListener('pointerup', releasePointerFocus)
  }, [])

  if (isLinkedDataMode && !linkedState) {
    const connection = getLinkedConnection()
    const httpChannel = linkedChannel === 'http'
    return <main className="linked-connection-state" role="status"><SurfaceCard><Heading as="h1" variant="result">{connection.status === 'disconnected' ? '联动数据未连接' : httpChannel ? '正在读取本地后台数据' : '正在连接联动演示'}</Heading><p>{connection.error ?? (httpChannel ? '正在从本地 admin-api 读取只读演示数据…' : '正在从同源演示入口读取本次临时数据…')}</p><small>{httpChannel ? '只读演示通道：不写入后台数据，不回退到浏览器缓存。' : '不会回退到浏览器缓存，也不会发送业务 API 请求。'}</small></SurfaceCard></main>
  }

  return (
    <div className="mobile-shell">
      <AuthPromptProvider>
        <Routes>
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/login" element={<LoginEntry method="one_tap" />} />
          <Route path="/login/code" element={<LoginEntry method="code" />} />
          <Route path="/login/password" element={<LoginEntry method="password" />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/sms-help" element={<SmsHelpPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/user-agreement" element={<UserAgreementPage />} />
          <Route element={<LaunchedApp />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/buy/game-zone" element={<GameZonePage />} />
            <Route path="/buy/list" element={<GameZonePage />} />
            <Route path="/game" element={<GameZonePage />} />
            <Route path="/game/select" element={<GameSelectPage />} />
            <Route path="/goods/:id" element={<ProductDetailPage />} />
            <Route path="/feedback" element={<FeedbackPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/component-library" element={<Suspense fallback={<main className="app-route-loading" role="status"><Spinner decorative />正在加载组件库…</main>}><ComponentLibraryPage /></Suspense>} />
            <Route path="/support" element={<Navigate to={SUPPORT_CONVERSATION_ROUTE} replace />} />
            <Route path="/im/:conversationId" element={<ConversationEntry />} />
            <Route path="/message/groups/:conversationId" element={<ConversationEntry />} />
            <Route element={<ProtectedApp />}>
              <Route path="/push-permission" element={<PushPermissionPage />} />
              <Route path="/orders/preview" element={isLinkedDataMode ? <LinkedFeatureUnavailable feature="订单与支付" /> : <OrderCheckoutPage />} />
              <Route path="/orders/checkout" element={isLinkedDataMode ? <LinkedFeatureUnavailable feature="订单与支付" /> : <OrderCheckoutPage />} />
              <Route path="/payment/cancel" element={<PaymentCancelPage />} />
              <Route path="/payment/success" element={isLinkedDataMode ? <LinkedFeatureUnavailable feature="订单与支付" /> : <PaymentSuccessPage />} />
              <Route path="/sell" element={<SellPage />} />
              <Route path="/sell/publish" element={isLinkedDataMode ? <LinkedFeatureUnavailable feature="账号回收" /> : <Navigate to="/sell" replace />} />
              <Route path="/appraisal" element={<AppraisalPage />} />
              <Route path="/appraisal/detail" element={isLinkedDataMode ? <LinkedFeatureUnavailable feature="账号回收" /> : <AppraisalDetailPage />} />
              <Route path="/appraisal/fill" element={isLinkedDataMode ? <LinkedFeatureUnavailable feature="账号回收" /> : <AppraisalFillPage />} />
              <Route path="/appraisal/loading" element={isLinkedDataMode ? <LinkedFeatureUnavailable feature="账号回收" /> : <AppraisalLoadingPage />} />
              <Route path="/footprints" element={<FootprintPage />} />
              <Route path="/reminders" element={<ReminderPage />} />
              <Route path="/messages" element={<MessageAlias />} />
              <Route path="/message" element={<MessagePage />} />
              <Route path="/notifications" element={<NotificationCenterPage />} />
              <Route path="/notifications/settings" element={<NotificationSettingsPage />} />
              <Route path="/footprint" element={<FootprintPage />} />
              <Route path="/orders" element={<OrderListPage />} />
              <Route path="/orders/recycle" element={isLinkedDataMode ? <LinkedFeatureUnavailable feature="账号回收" /> : <RecycleOrderListPage />} />
              <Route path="/orders/:id" element={<OrderDetailPage />} />
              <Route path="/fulfillment/contracts/:contractId" element={isLinkedDataMode ? <LinkedFeatureUnavailable feature="履约合同" /> : <FulfillmentContractPage />} />
              <Route path="/wallet" element={isLinkedDataMode ? <LinkedFeatureUnavailable feature="钱包" /> : <WalletOverviewPage />} />
              <Route path="/wallet/withdraw" element={isLinkedDataMode ? <LinkedFeatureUnavailable feature="钱包提现" /> : <WalletWithdrawPage />} />
              <Route path="/favorites" element={isLinkedDataMode ? <LinkedFeatureUnavailable feature="收藏" /> : <FavoritesPage />} />
              <Route path="/sell/goods" element={isLinkedDataMode ? <LinkedFeatureUnavailable feature="账号回收" /> : <SellGoodsPage />} />
              <Route path="/aftersales" element={isLinkedDataMode ? <LinkedFeatureUnavailable feature="售后" /> : <AfterSalesPage />} />
              <Route path="/aftersales/apply" element={<AfterSaleApplyPage />} />
              <Route path="/aftersales/:id" element={isLinkedDataMode ? <LinkedFeatureUnavailable feature="售后" /> : <AfterSaleDetailPage />} />
              <Route path="/seller/center" element={<SellerCenterPage />} />
              {isLinkedDataMode && <Route path="/seller" element={<SellerCenterPage />} />}
              <Route path="/seller/apply/personal" element={<PersonalSellerContractPage />} />
              <Route path="/seller/apply/business" element={<BusinessSellerContractPage />} />
              {isLinkedDataMode && <Route path="/linked/publish" element={<LinkedGoodsPublishPage />} />}
              {isLinkedDataMode && <Route path="/linked/my-goods" element={<LinkedGoodsListPage />} />}
              {isLinkedDataMode && <Route path="/publish" element={<LinkedGoodsPublishPage />} />}
              {isLinkedDataMode && <Route path="/my-goods" element={<LinkedGoodsListPage />} />}
              <Route path="/realname" element={<RealNamePage />} />
              <Route path="/account-security/profile" element={<ProfileIdentityPage />} />
              <Route path="/account-security/phone" element={<PhoneSettingsPage />} />
              <Route path="/account-security" element={<AccountSecurityPage />} />
              <Route path="/settings" element={<AccountSettingsPage />} />
              <Route path="/settings/password" element={<PasswordSettingsPage />} />
              <Route path="/settings/bindings" element={<ThirdPartyBindingsPage />} />
              <Route path="/settings/cancellation" element={<AccountCancellationPage />} />
              <Route path="/privacy-and-agreements" element={<PrivacyAgreementCenterPage />} />
              <Route path="/about-us" element={<AboutUsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthPromptProvider>
    </div>
  )
}
