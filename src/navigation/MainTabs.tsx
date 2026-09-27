import React, {useEffect, useState} from 'react';
import {Pressable, SafeAreaView, StyleSheet, Text, View} from 'react-native';
import ArchiveScreen from '../features/archive/ArchiveScreen';
import HomeScreen from '../features/home/HomeScreen';
import ProfileScreen from '../features/profile/ProfileScreen';
import {listFamilyParents} from '../services/profileApi';
import {getAccessToken} from '../services/session';
import {text} from '../shared/i18n/messages';
import {colors, radius, spacing, touch, typography} from '../theme/tokens';

type Tab = 'inquiry' | 'archive' | 'profile' | 'parentReports';

type Props = {
  phone: string;
  onLogout: () => void;
};

const tabs: Tab[] = ['inquiry', 'archive', 'parentReports', 'profile'];

export default function MainTabs({phone, onLogout}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('inquiry');
  const [familyLookupFailed, setFamilyLookupFailed] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token || token.startsWith('demo-')) {
      setFamilyLookupFailed(false);
      return;
    }
    let mounted = true;
    listFamilyParents(token)
      .then(() => {
        if (mounted) {
          setFamilyLookupFailed(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setFamilyLookupFailed(true);
        }
      });
    return () => {
      mounted = false;
    };
  }, [phone]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        {activeTab === 'inquiry' && <HomeScreen />}
        {activeTab === 'archive' && <ArchiveScreen />}
        {activeTab === 'parentReports' ? (
          <ArchiveScreen familyViewOnly familyLookupFailed={familyLookupFailed} />
        ) : null}
        {activeTab === 'profile' && <ProfileScreen phone={phone} onLogout={onLogout} />}
      </View>
      <View style={styles.tabBar} accessibilityRole="tablist">
        {tabs.map(tab => {
          const active = activeTab === tab;
          return (
            <Pressable
              key={tab}
              accessibilityRole="tab"
              accessibilityState={{selected: active}}
              accessibilityLabel={text('zh', tab)}
              onPress={() => setActiveTab(tab)}
              style={[styles.tabButton, active && styles.activeTab]}>
              <Text style={[styles.tabText, active && styles.activeText]}>{text('zh', tab)}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: colors.backgroundWarm},
  content: {flex: 1, minHeight: 0, overflow: 'hidden'},
  tabBar: {
    flexShrink: 0,
    zIndex: 10,
    elevation: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderNeutral,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.page,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
  },
  tabButton: {
    flex: 1,
    minHeight: touch.tabHeight,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTab: {backgroundColor: colors.primarySoft},
  tabText: {...typography.bodyStrong, color: colors.textSecondary},
  activeText: {color: colors.primaryDark},
});
