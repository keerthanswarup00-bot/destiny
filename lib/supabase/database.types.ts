type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Insert = Partial<Row>, Update = Partial<Insert>> = { Row: Row; Insert: Insert; Update: Update; Relationships: [] };

export type Database = {
  public: {
    Tables: {
      admin_users: Table<{ id: string; created_at: string }, { id: string; created_at?: string }>;
      clients: Table<{
        id: string;
        name: string;
        event_date: string | null;
        phone: string | null;
        notes: string | null;
        created_by: string | null;
        created_at: string;
        updated_at: string;
      }, {
        id?: string;
        name: string;
        event_date?: string | null;
        phone?: string | null;
        notes?: string | null;
        created_by?: string | null;
        created_at?: string;
        updated_at?: string;
      }>;
      contact_submissions: Table<{
        id: string;
        name: string;
        email: string | null;
        phone: string;
        event_type: string | null;
        event_date: string | null;
        message: string | null;
        status: "new" | "contacted" | "closed";
        source: "website";
        created_at: string;
        updated_at: string;
      }, {
        id?: string;
        name: string;
        email?: string | null;
        phone: string;
        event_type?: string | null;
        event_date?: string | null;
        message?: string | null;
        status?: "new" | "contacted" | "closed";
        source?: "website";
        created_at?: string;
        updated_at?: string;
      }>;
      galleries: Table<{
        id: string;
        client_id: string;
        title: string;
        slug: string;
        description: string | null;
        event_date: string | null;
        status: "draft" | "published" | "archived";
        password_hash: string | null;
        client_password_hash: string | null;
        category: string | null;
        location: string | null;
        show_in_portfolio: boolean;
        portfolio_sort: number;
        highlight_photo_id: string | null;
        highlight_crop: Json | null;
        created_by: string | null;
        created_at: string;
        updated_at: string;
      }, {
        id?: string;
        client_id: string;
        title: string;
        slug: string;
        description?: string | null;
        event_date?: string | null;
        status?: "draft" | "published" | "archived";
        password_hash?: string | null;
        client_password_hash?: string | null;
        category?: string | null;
        location?: string | null;
        show_in_portfolio?: boolean;
        portfolio_sort?: number;
        highlight_photo_id?: string | null;
        highlight_crop?: Json | null;
        created_by?: string | null;
        created_at?: string;
        updated_at?: string;
      }>;
      folders: Table<{
        id: string;
        gallery_id: string;
        parent_folder_id: string | null;
        name: string;
        slug: string;
        description: string | null;
        sort_order: number;
        published: boolean;
        cover_photo_id: string | null;
        created_at: string;
        updated_at: string;
      }, {
        id?: string;
        gallery_id: string;
        parent_folder_id?: string | null;
        name: string;
        slug: string;
        description?: string | null;
        sort_order?: number;
        published?: boolean;
        cover_photo_id?: string | null;
        created_at?: string;
        updated_at?: string;
      }>;
      photos: Table<{
        id: string;
        gallery_id: string;
        folder_id: string;
        filename: string;
        original_path: string;
        preview_path: string | null;
        thumbnail_path: string | null;
        download_path: string | null;
        mime_type: string;
        bytes: number;
        width: number | null;
        height: number | null;
        category: string | null;
        published_category: string | null;
        published: boolean;
        pending_delete: boolean;
        sort_order: number;
        created_at: string;
        updated_at: string;
      }, {
        id?: string;
        gallery_id: string;
        folder_id: string;
        filename: string;
        original_path: string;
        preview_path?: string | null;
        thumbnail_path?: string | null;
        download_path?: string | null;
        mime_type: string;
        bytes: number;
        width?: number | null;
        height?: number | null;
        category?: string | null;
        published_category?: string | null;
        published?: boolean;
        pending_delete?: boolean;
        sort_order?: number;
        created_at?: string;
        updated_at?: string;
      }>;
      profiles: Table<{
        id: string;
        email: string;
        marketing_optin: boolean;
        created_at: string;
        updated_at: string;
      }, {
        id?: string;
        email: string;
        marketing_optin?: boolean;
        created_at?: string;
        updated_at?: string;
      }>;
      selections: Table<{
        id: string;
        gallery_id: string;
        photo_id: string;
        viewer_name: string;
        viewer_key_hash: string | null;
        profile_id: string | null;
        created_at: string;
        updated_at: string;
      }, {
        id?: string;
        gallery_id: string;
        photo_id: string;
        viewer_name?: string;
        viewer_key_hash?: string | null;
        profile_id?: string | null;
        created_at?: string;
        updated_at?: string;
      }>;
      photo_shares: Table<{
        id: string;
        gallery_id: string;
        photo_id: string;
        token_hash: string;
        expires_at: string | null;
        revoked_at: string | null;
        created_by: string | null;
        created_at: string;
      }, {
        id?: string;
        gallery_id: string;
        photo_id: string;
        token_hash: string;
        expires_at?: string | null;
        revoked_at?: string | null;
        created_by?: string | null;
        created_at?: string;
      }>;
      selection_submissions: Table<{
        id: string;
        gallery_id: string;
        selection_session_hash: string | null;
        profile_id: string | null;
        photo_count: number;
        status: "submitted";
        submitted_at: string;
      }, {
        id?: string;
        gallery_id: string;
        selection_session_hash?: string | null;
        profile_id?: string | null;
        photo_count: number;
        status?: "submitted";
        submitted_at?: string;
      }>;
      client_selection_photos: Table<{
        id: string;
        gallery_id: string;
        photo_id: string;
        profile_id: string;
        created_at: string;
      }, {
        id?: string;
        gallery_id: string;
        photo_id: string;
        profile_id: string;
        created_at?: string;
      }>;
      access_attempts: Table<{
        id: string;
        gallery_id: string;
        succeeded: boolean;
        attempted_at: string;
        ip_hash: string | null;
        user_agent: string | null;
        failure_reason: string | null;
      }, {
        id?: string;
        gallery_id: string;
        succeeded: boolean;
        attempted_at?: string;
        ip_hash?: string | null;
        user_agent?: string | null;
        failure_reason?: string | null;
      }>;
      gallery_views: Table<{
        id: string;
        gallery_id: string;
        visitor_key: string;
        view_count: number;
        first_viewed_at: string;
        last_viewed_at: string;
      }, {
        id?: string;
        gallery_id: string;
        visitor_key: string;
        view_count?: number;
        first_viewed_at?: string;
        last_viewed_at?: string;
      }>;
      website_home_items: Table<{
        id: string;
        section: "hero" | "selected_work" | "studio" | "cta";
        title: string | null;
        category: string | null;
        href: string | null;
        asset_path: string | null;
        asset_mime: string | null;
        asset_bytes: number | null;
        sort_order: number;
        published: boolean;
        created_at: string;
        updated_at: string;
      }>;
      website_portfolio_projects: Table<{
        id: string;
        title: string;
        slug: string;
        category: string | null;
        description: string | null;
        cover_path: string | null;
        cover_mime: string | null;
        cover_width: number | null;
        cover_height: number | null;
        sort_order: number;
        published: boolean;
        created_at: string;
        updated_at: string;
      }>;
      website_portfolio_photos: Table<{
        id: string;
        project_id: string;
        asset_path: string;
        asset_mime: string;
        asset_bytes: number;
        width: number | null;
        height: number | null;
        sort_order: number;
        created_at: string;
      }>;
      site_home: Table<{
        id: string;
        hero: Json;
        what_we_document: Json;
        stories: Json;
        approach: Json;
        cta: Json;
        created_at: string;
        updated_at: string;
      }, {
        id: string;
        hero?: Json;
        what_we_document?: Json;
        stories?: Json;
        approach?: Json;
        cta?: Json;
        created_at?: string;
        updated_at?: string;
      }>;
      site_stories: Table<{
        id: string;
        gallery_id: string;
        title: string | null;
        category: string | null;
        location: string | null;
        event_date: string | null;
        sort_order: number;
        published: boolean;
        created_at: string;
        updated_at: string;
      }, {
        id?: string;
        gallery_id: string;
        title?: string | null;
        category?: string | null;
        location?: string | null;
        event_date?: string | null;
        sort_order?: number;
        published?: boolean;
        created_at?: string;
        updated_at?: string;
      }>;
      site_contact: Table<{
        id: string;
        studio_name: string | null;
        email: string | null;
        phone: string | null;
        whatsapp: string | null;
        instagram: string | null;
        location: string | null;
        address: string | null;
        hours: string | null;
        heading: string | null;
        description: string | null;
        cta_text: string | null;
        created_at: string;
        updated_at: string;
      }, {
        id: string;
        studio_name?: string | null;
        email?: string | null;
        phone?: string | null;
        whatsapp?: string | null;
        instagram?: string | null;
        location?: string | null;
        address?: string | null;
        hours?: string | null;
        heading?: string | null;
        description?: string | null;
        cta_text?: string | null;
        created_at?: string;
        updated_at?: string;
      }>;
      site_branding: Table<{
        id: string;
        brand_name: string | null;
        short_name: string | null;
        tagline: string | null;
        logo_path: string | null;
        logo_mime: string | null;
        light_logo_path: string | null;
        light_logo_mime: string | null;
        dark_logo_path: string | null;
        dark_logo_mime: string | null;
        favicon_path: string | null;
        social_image_path: string | null;
        watermark_path: string | null;
        watermark_mime: string | null;
        watermark_enabled: boolean;
        watermark_opacity: number;
        watermark_scale: number;
        watermark_margin: number;
        watermark_position: string;
        created_at: string;
        updated_at: string;
      }, {
        id: string;
        brand_name?: string | null;
        short_name?: string | null;
        tagline?: string | null;
        logo_path?: string | null;
        logo_mime?: string | null;
        light_logo_path?: string | null;
        light_logo_mime?: string | null;
        dark_logo_path?: string | null;
        dark_logo_mime?: string | null;
        favicon_path?: string | null;
        social_image_path?: string | null;
        watermark_path?: string | null;
        watermark_mime?: string | null;
        watermark_enabled?: boolean;
        watermark_opacity?: number;
        watermark_scale?: number;
        watermark_margin?: number;
        watermark_position?: string;
        created_at?: string;
        updated_at?: string;
      }>;
      site_theme: Table<{
        id: string;
        preset: string;
        accent: string | null;
        created_at: string;
        updated_at: string;
      }, {
        id: string;
        preset?: string;
        accent?: string | null;
        created_at?: string;
        updated_at?: string;
      }>;
    };
    Views: Record<string, never>;
    Functions: {
      check_admin_login_rate_limit: {
        Args: {
          p_account_key: string | null;
          p_account_limit: number;
          p_network_key: string | null;
          p_network_limit: number;
          p_window_minutes: number;
        };
        Returns: boolean;
      };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      record_admin_login_failure: {
        Args: {
          p_account_key: string | null;
          p_network_key: string | null;
          p_window_minutes: number;
        };
        Returns: undefined;
      };
      record_gallery_view: {
        Args: {
          p_gallery_id: string;
          p_visitor_key: string;
        };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
} & { _json: Json };