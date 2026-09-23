import React, {useEffect, useState} from 'react';
import {Pressable, SafeAreaView, StyleSheet, Text, View} from 'react-native';
import ArchiveScreen from '../features/archive/ArchiveScreen';
import HomeScreen from '../features/home/HomeScreen';
import ProfileScreen from '../features/profile/ProfileScreen';
import {listFamilyParents, type FamilyParent} from '../services/profileApi';
import {getAccessToken} from '../services/session';
import {text} from '../shared/i18n/messages';
import {colors, radius, spacing, touch, typography} from '../theme/tokens';

type Tab = 'inquiry' | 'archive' | 'profile' | 'parentReports';

type Props = {
  phone: string;
  onLogout: () => void;
};

const seniorTabs: Tab[] = ['inquiry', 'archive', 'profile'];

export default function MainTabs({phone, onLogout}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('inquiry');
  const [familyParents, setFamilyParents] = useState<FamilyParent[]>([]);
  const [familyLookupFailed, setFamilyLookupFailed] = useState(false);
  // Always expose the entry point; if the backend lookup fails, the page explains the issue
  // instead of silently hiding the feature from the child account.
  const tabs: Tab[] = [...seniorTabs, 'parentReports'];

  useEffect(() => {
    const token = getAccessToken();
    if (!token || token.startsWith('demo-')) {
      setFamilyParents([]);
      setFamilyLookupFailed(false);
      return;
    }
    let mounted = true;
    listFamilyParents(token)
      .then(result => {
        if (mounted) {
          setFamilyParents(result.items || []);
          setFamilyLookupFailed(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setFamilyParents([]);
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
          <ArchiveScreen
            key={`parent-reports-${familyParents[0]?.id || phone}`}
            familyViewOnly
            initialParentId={familyParents[0]?.id}
            familyLookupFailed={familyLookupFailed}
          />
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
              style={[
                styles.tabButton,
                active && styles.activeTab,
              ]}>
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
