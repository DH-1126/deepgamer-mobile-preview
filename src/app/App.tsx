import { useEffect } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { HomePage } from '../pages/HomePage'
import { SearchPage } from '../pages/SearchPage'
import { GameZonePage } from '../pages/GameZonePage'
import { GameSelectPage } from '../pages/GameSelectPage'
import { ProductDetailPage } from '../pages/ProductDetailPage'
import { ProfilePage } from '../pages/ProfilePage'
import { FavoritesPage } from '../pages/FavoritesPage'
import { MessagePage } from '../pages/MessagePage'
import { GroupChatPage } from '../pages/GroupChatPage'
import { LoginPage, PrivacyPolicyPage, PushPermissionPage, UserAgreementPage, WelcomePage } from '../pages/AuthPage'
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
  PasswordSettingsPage,
  PrivacyAgreementCenterPage,
  ThirdPartyBindingsPage,
} from '../pages/ProfileSettingsPages'
import { BusinessSellerContractPage, PersonalSellerContractPage, SellerCenterPage } from '../pages/SellerContractPages'
import { RealNamePage } from '../pages/RealNamePage'
import { AfterSaleDetailPage, AfterSalesPage } from '../pages/AfterSalesPage'
import { FeedbackPage } from '../pages/FeedbackPage'
import { FootprintPage } from '../pages/FootprintPage'
import { ReminderPage } from '../pages/ReminderPage'
import { NotificationCenterPage, NotificationSettingsPage } from '../pages/NotificationPages'
import { authRepository } from '../repository/authRepository'
import { SUPPORT_CONVERSATION_ROUTE } from '../data/messageFixtures'
import type { AuthMethod } from '../types/auth'

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
            <Route path="/game/select" element={<GameSelectPage />} />
            <Route path="/goods/:id" element={<ProductDetailPage />} />
            <Route path="/feedback" element={<FeedbackPage />} />
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
              <Route path="/footprints" element={<FootprintPage />} />
              <Route path="/reminders" element={<ReminderPage />} />
              <Route path="/messages" element={<MessageAlias />} />
              <Route path="/message" element={<MessagePage />} />
              <Route path="/notifications" element={<NotificationCenterPage />} />
              <Route path="/notifications/settings" element={<NotificationSettingsPage />} />
              <Route path="/im/:conversationId" element={<GroupChatPage />} />
              <Route path="/message/groups/:conversationId" element={<GroupChatPage />} />
              <Route path="/footprint" element={<FootprintPage />} />
              <Route path="/orders" element={<OrderListPage />} />
              <Route path="/orders/recycle" element={<RecycleOrderListPage />} />
              <Route path="/orders/:id" element={<OrderDetailPage />} />
              <Route path="/fulfillment/contracts/:contractId" element={<FulfillmentContractPage />} />
              <Route path="/wallet" element={<WalletOverviewPage />} />
              <Route path="/wallet/withdraw" element={<WalletWithdrawPage />} />
              <Route path="/favorites" element={<FavoritesPage />} />
              <Route path="/sell/goods" element={<SellGoodsPage />} />
              <Route path="/aftersales" element={<AfterSalesPage />} />
              <Route path="/aftersales/:id" element={<AfterSaleDetailPage />} />
              <Route path="/seller/center" element={<SellerCenterPage />} />
              <Route path="/seller/apply/personal" element={<PersonalSellerContractPage />} />
              <Route path="/seller/apply/business" element={<BusinessSellerContractPage />} />
              <Route path="/realname" element={<RealNamePage />} />
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
