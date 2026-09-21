import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { AppHeader } from '../../components/AppHeader';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { colors, spacing, borderRadius, typography, shadows } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  getMyNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../../services/notificationService';
import { NotificationItem } from '../../types/notification';

export default function NotificationsScreen() {
  const router = useRouter();
  const { isDark, colors: themeColors } = useTheme();
  const { t } = useLanguage();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [markingAll, setMarkingAll] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const fetchNotifications = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setErrorMsg('');

    try {
      const res = await getMyNotifications();
      if (res && res.success) {
        setNotifications(res.data || []);
        setUnreadCount(res.unreadCount || 0);
      } else {
        setErrorMsg('Unable to load notifications.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to retrieve notifications.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchNotifications(true);
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, status: 'READ', readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      // Refresh on error to restore true state
      fetchNotifications(true);
    } finally {
      setMarkingAll(false);
    }
  };

  const handleOpenMedication = async (item: NotificationItem) => {
    if (item.status === 'UNREAD') {
      try {
        await markNotificationAsRead(item._id);
        setNotifications((prev) =>
          prev.map((n) =>
            n._id === item._id
              ? { ...n, status: 'READ', readAt: new Date().toISOString() }
              : n
          )
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch (err) {
        // Continue navigation regardless of mark error
      }
    }

    router.push('/(patient)/today-medication' as any);
  };

  const formatTimeAmPm = (time24?: string): string => {
    if (!time24) return '';
    const [h, m] = time24.split(':').map(Number);
    if (isNaN(h)) return time24;
    const period = h >= 12 ? 'PM' : 'AM';
    const hours12 = h % 12 === 0 ? 12 : h % 12;
    return `${hours12}:${String(m || 0).padStart(2, '0')} ${period}`;
  };

  const filteredNotifications =
    activeTab === 'unread'
      ? notifications.filter((n) => n.status === 'UNREAD')
      : notifications;

  if (loading && notifications.length === 0) {
    return <LoadingView message="Loading notifications..." />;
  }

  return (
    <ScreenContainer backgroundColor={themeColors.background}>
      <AppHeader
        title={t('notificationCenter')}
        subtitle={
          unreadCount > 0
            ? `${unreadCount} ${t('unread')}`
            : t('allCaughtUp')
        }
        onBackPress={() => router.back()}
        rightComponent={
          unreadCount > 0 ? (
            <TouchableOpacity
              style={[
                styles.markAllBtn,
                { backgroundColor: themeColors.primaryLight, borderColor: themeColors.primary },
              ]}
              onPress={handleMarkAllAsRead}
              disabled={markingAll}
            >
              {markingAll ? (
                <ActivityIndicator size="small" color={themeColors.primary} />
              ) : (
                <Text style={[styles.markAllText, { color: themeColors.primary }]}>
                  {t('markAllAsRead')}
                </Text>
              )}
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* Segmented Filter Tabs */}
      <View style={[styles.tabBar, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'all' && {
              backgroundColor: themeColors.primary,
              borderRadius: borderRadius.md,
            },
          ]}
          onPress={() => setActiveTab('all')}
        >
          <Text
            style={[
              styles.tabText,
              { color: themeColors.textSecondary },
              activeTab === 'all' && styles.tabTextActive,
            ]}
          >
            {t('all')} ({notifications.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'unread' && {
              backgroundColor: themeColors.primary,
              borderRadius: borderRadius.md,
            },
          ]}
          onPress={() => setActiveTab('unread')}
        >
          <Text
            style={[
              styles.tabText,
              { color: themeColors.textSecondary },
              activeTab === 'unread' && styles.tabTextActive,
            ]}
          >
            {t('unread')} ({unreadCount})
          </Text>
        </TouchableOpacity>
      </View>

      {errorMsg ? (
        <ErrorView message={errorMsg} onRetry={() => fetchNotifications(true)} />
      ) : null}

      <FlatList
        data={filteredNotifications}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[themeColors.primary]}
            tintColor={themeColors.primary}
          />
        }
        ListEmptyComponent={
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: themeColors.card, borderColor: themeColors.border },
            ]}
          >
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>
              {t('noNotifications')}
            </Text>
            <Text style={[styles.emptyDesc, { color: themeColors.textSecondary }]}>
              {t('noNotificationsDesc')}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isUnread = item.status === 'UNREAD';
          const isMissed = item.type === 'MISSED_MEDICATION';
          const isTaken = item.type === 'MEDICATION_TAKEN';

          return (
            <View
              style={[
                styles.notifCard,
                {
                  backgroundColor: themeColors.card,
                  borderColor: isUnread
                    ? isMissed
                      ? colors.danger
                      : themeColors.primary
                    : themeColors.border,
                  borderWidth: isUnread ? 1.5 : 1,
                },
              ]}
            >
              <View style={styles.cardTopRow}>
                {/* Type Icon Badge */}
                <View
                  style={[
                    styles.iconCircle,
                    {
                      backgroundColor: isMissed
                        ? isDark
                          ? 'rgba(239, 68, 68, 0.2)'
                          : '#FEE2E2'
                        : isTaken
                        ? themeColors.successLight
                        : isDark
                        ? 'rgba(59, 130, 246, 0.2)'
                        : '#EFF6FF',
                    },
                  ]}
                >
                  <Text style={styles.iconText}>
                    {isMissed ? '⚠️' : isTaken ? '✓' : '🔔'}
                  </Text>
                </View>

                <View style={styles.headerTextCol}>
                  <View style={styles.titleRow}>
                    <Text
                      style={[
                        styles.notifTitle,
                        {
                          color: isMissed
                            ? colors.danger
                            : themeColors.textPrimary,
                        },
                      ]}
                    >
                      {item.title}
                    </Text>
                    {isUnread && (
                      <View
                        style={[
                          styles.unreadDot,
                          {
                            backgroundColor: isMissed
                              ? colors.danger
                              : themeColors.primary,
                          },
                        ]}
                      />
                    )}
                  </View>
                  <Text
                    style={[styles.notifMessage, { color: themeColors.textSecondary }]}
                  >
                    {item.message}
                  </Text>
                </View>
              </View>

              {/* Medicine & Schedule Details Box */}
              {item.medicineName ? (
                <View
                  style={[
                    styles.medDetailsBox,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.04)'
                        : '#F9FAFB',
                      borderColor: themeColors.border,
                    },
                  ]}
                >
                  <View style={styles.medRow}>
                    <Text style={[styles.medName, { color: themeColors.textPrimary }]}>
                      💊 {item.medicineName}
                    </Text>
                    {item.dosage ? (
                      <Text style={[styles.medDosage, { color: themeColors.textSecondary }]}>
                        ({item.dosage})
                      </Text>
                    ) : null}
                  </View>
                  {item.scheduledTime ? (
                    <Text style={[styles.schedTimeText, { color: themeColors.primary }]}>
                      ⏰ {t('scheduledAt')}: {formatTimeAmPm(item.scheduledTime)}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {/* Action Button: Open Medication */}
              <View style={styles.cardActionsRow}>
                <TouchableOpacity
                  style={[
                    styles.openMedBtn,
                    {
                      backgroundColor: isMissed
                        ? colors.danger
                        : themeColors.primary,
                    },
                  ]}
                  activeOpacity={0.8}
                  onPress={() => handleOpenMedication(item)}
                >
                  <Text style={styles.openMedBtnText}>
                    {t('openMedication')} →
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  markAllBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
  },
  markAllText: {
    ...typography.caption,
    fontWeight: '800',
    fontSize: 11,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    padding: 3,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  tabItem: {
    flex: 1,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    ...typography.caption,
    fontWeight: '700',
    fontSize: 13,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  notifCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  iconText: {
    fontSize: 20,
  },
  headerTextCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notifTitle: {
    ...typography.subheader,
    fontSize: 15,
    fontWeight: '800',
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    marginLeft: spacing.xs,
  },
  notifMessage: {
    ...typography.caption,
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  medDetailsBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  medRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  medName: {
    ...typography.bodyBold,
    fontSize: 14,
  },
  medDosage: {
    ...typography.caption,
    fontSize: 13,
  },
  schedTimeText: {
    ...typography.caption,
    fontWeight: '700',
    fontSize: 12,
    marginTop: 4,
  },
  cardActionsRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  openMedBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
  },
  openMedBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  emptyCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.xl,
    borderWidth: 1,
  },
  emptyIcon: {
    fontSize: 38,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    ...typography.subheader,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  emptyDesc: {
    ...typography.caption,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
});
