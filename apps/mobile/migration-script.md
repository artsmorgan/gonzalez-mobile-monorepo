# React Navigation Migration Progress

## ✅ Completed:

1. Updated package.json main entry to "index.js"
2. Created index.js root entry
3. Created App.tsx with React Navigation Stack
4. Created HomeScreen.tsx (migrated from index.tsx)
5. Created DigitalSignatureScreen.tsx (fully migrated)
6. Partially migrated RolesScreen.tsx

## 🔄 In Progress / Remaining:

- RolesScreen.tsx - needs router.navigate('/role-permissions') fix
- RulesScreen.tsx - needs full migration
- PermissionsScreen.tsx - needs full migration
- RolePermissionsScreen.tsx - needs full migration
- LunchTimeScreen.tsx - needs full migration
- RecoverPasswordScreen.tsx - needs full migration

## Migration Pattern:

For each screen file:

1. Change imports:
   - `'@/components/...'` → `'../components/...'`
   - `'@/contexts/...'` → `'../contexts/...'`
   - `'@/hooks/...'` → `'../hooks/...'`
2. Replace navigation imports:

   - Remove: `import { router } from 'expo-router'` or `import { useRouter } from 'expo-router'`
   - Add:
     ```typescript
     import { useNavigation } from '@react-navigation/native';
     import { NativeStackNavigationProp } from '@react-navigation/native-stack';
     import { RootStackParamList } from '../App';
     type [ScreenName]NavigationProp = NativeStackNavigationProp<RootStackParamList, '[ScreenName]'>;
     ```

3. Replace router usage:
   - `const router = useRouter()` → `const navigation = useNavigation<[ScreenName]NavigationProp>()`
   - `router.navigate('/path')` → `navigation.navigate('ScreenName')`
   - `router.back()` → `navigation.goBack()`
   - `router.replace('/path')` → `navigation.replace('ScreenName')`
   - `router.push('/path')` → `navigation.push('ScreenName')`

## Navigation Routes Map:

- `/` or `/(tabs)` → 'Home'
- `/roles` → 'Roles'
- `/rules` → 'Rules'
- `/permissions` → 'Permissions'
- `/role-permissions` → 'RolePermissions'
- `/lunch-time` → 'LunchTime'
- `/digital-signature` → 'DigitalSignature'
- `/recover-password` → 'RecoverPassword'
