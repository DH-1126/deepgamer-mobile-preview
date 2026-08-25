import { Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { HomePage } from '../pages/HomePage'
import { SearchPage } from '../pages/SearchPage'
import { GameZonePage } from '../pages/GameZonePage'
import { ProductDetailPage } from '../pages/ProductDetailPage'
import { ProfilePage } from '../pages/ProfilePage'
import { FavoritesPage } from '../pages/FavoritesPage'
import { MessagePage } from '../pages/MessagePage'
import { GroupChatPage } from '../pages/GroupChatPage'
import { LoginPage, PrivacyPolicyPage, PushPermissionPage, UserAgreementPage, WelcomePage } from '../pages/AuthPage'
import { AuthPromptProvider, RequireAuth } from '../components/AuthAccess'
import { OrderCheckoutPage, OrderDetailPage, OrderListPage, PaymentCancelPage, PaymentSuccessPage } from '../pages/OrderPages'
import { AppraisalDetailPage, AppraisalFillPage, AppraisalLoadingPage, AppraisalPage, SellGoodsPage, SellPage } from '../pages/SellPages'
import { FulfillmentContractPage } from '../pages/FulfillmentContractPage'
import { authRepository } from '../repository/authRepository'
import { SUPPORT_CONVERSATION_ROUTE } from '../data/messageFixtures'
import type { AuthMethod } from '../types/auth'

function PlaceholderPage({ title, detail }: { title: string; detail: string }) {
  return <main className="placeholder-page"><strong>深度玩家</strong><h1>{title}</h1><p>{detail}</p><Link to="/">返回首页</Link></main>
}

function MessageAlias() {
  const { search, hash } = useLocation()
  return <Navigate to={`/message${search}${hash}`} replace />
}

function ProtectedApp() {
  return <RequireAuth><Outlet /></RequireAuth>
}

function LaunchedApp() {
  const location = useLocation()
  if (authRepository.hasCompletedLaunch()) return <Outlet />
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
  return (
    <div className="mobile-shell">
      <AuthPromptProvider>
        <Routes>
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/login" element={<LoginEntry method="one_tap" />} />
          <Route path="/login/code" element={<LoginEntry method="code" />} />
          <Route path="/login/password" element={<LoginEntry method="password" />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/user-agreement" element={<UserAgreementPage />} />
          <Route element={<LaunchedApp />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/buy/game-zone" element={<GameZonePage />} />
            <Route path="/buy/list" element={<GameZonePage />} />
            <Route path="/game" element={<GameZonePage />} />
            <Route path="/game/select" element={<Navigate to="/#game-selection" replace />} />
            <Route path="/goods/:id" element={<ProductDetailPage />} />
            <Route path="/feedback" element={<PlaceholderPage title="吐槽广场" detail="建议与吐槽入口正在接入。" />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route element={<ProtectedApp />}>
              <Route path="/push-permission" element={<PushPermissionPage />} />
              <Route path="/orders/preview" element={<OrderCheckoutPage />} />
              <Route path="/orders/checkout" element={<OrderCheckoutPage />} />
              <Route path="/payment/cancel" element={<PaymentCancelPage />} />
              <Route path="/payment/success" element={<PaymentSuccessPage />} />
              <Route path="/sell" element={<SellPage />} />
              <Route path="/sell/publish" element={<Navigate to="/sell" replace />} />
              <Route path="/appraisal" element={<AppraisalPage />} />
              <Route path="/appraisal/detail" element={<AppraisalDetailPage />} />
              <Route path="/appraisal/fill" element={<AppraisalFillPage />} />
              <Route path="/appraisal/loading" element={<AppraisalLoadingPage />} />
              <Route path="/support" element={<Navigate to={SUPPORT_CONVERSATION_ROUTE} replace />} />
              <Route path="/footprints" element={<PlaceholderPage title="全部足迹" detail="你的完整浏览足迹将在这里展示。" />} />
              <Route path="/messages" element={<MessageAlias />} />
              <Route path="/message" element={<MessagePage />} />
              <Route path="/im/:conversationId" element={<GroupChatPage />} />
              <Route path="/message/groups/:conversationId" element={<GroupChatPage />} />
              <Route path="/footprint" element={<PlaceholderPage title="足迹" detail="你的完整浏览足迹将在这里展示。" />} />
              <Route path="/orders" element={<OrderListPage />} />
              <Route path="/orders/:id" element={<OrderDetailPage />} />
              <Route path="/fulfillment/contracts/:contractId" element={<FulfillmentContractPage />} />
              <Route path="/wallet" element={<PlaceholderPage title="我的钱包" detail="钱包余额与明细将在这里展示。" />} />
              <Route path="/favorites" element={<FavoritesPage />} />
              <Route path="/sell/goods" element={<SellGoodsPage />} />
              <Route path="/aftersales" element={<PlaceholderPage title="我的售后" detail="售后申请与处理进度将在这里展示。" />} />
              <Route path="/seller/center" element={<PlaceholderPage title="卖家签约" detail="签约后可查看适用的手续费方案。" />} />
              <Route path="/realname" element={<PlaceholderPage title="实名认证" detail="实名认证服务正在接入。" />} />
              <Route path="/settings" element={<PlaceholderPage title="设置" detail="账号与隐私设置将在这里展示。" />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthPromptProvider>
    </div>
  )
}
