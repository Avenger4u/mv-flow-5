CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'user'
);


--
-- Name: generate_party_prefix(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_party_prefix(party_name text) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  words TEXT[];
  prefix TEXT := '';
  word TEXT;
BEGIN
  -- Split name into words
  words := string_to_array(upper(party_name), ' ');
  
  -- Get first letter of each word (max 3 letters)
  FOREACH word IN ARRAY words
  LOOP
    IF length(prefix) < 3 AND length(word) > 0 THEN
      prefix := prefix || left(word, 1);
    END IF;
  END LOOP;
  
  -- If only one letter, take first 2 letters of name
  IF length(prefix) < 2 THEN
    prefix := upper(left(party_name, 2));
  END IF;
  
  RETURN prefix;
END;
$$;


--
-- Name: get_next_order_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_next_order_number() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  next_num INTEGER;
  prefix_val TEXT;
BEGIN
  UPDATE public.order_counter 
  SET current_number = current_number + 1 
  WHERE id = 1
  RETURNING current_number, prefix INTO next_num, prefix_val;
  
  RETURN prefix_val || '/' || next_num;
END;
$$;


--
-- Name: get_party_order_number(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_party_order_number(p_party_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  party_prefix TEXT;
  party_name TEXT;
  next_num INTEGER;
BEGIN
  -- Get party details
  SELECT name, prefix, last_order_number + 1
  INTO party_name, party_prefix, next_num
  FROM public.parties
  WHERE id = p_party_id;
  
  -- If no prefix set, generate one
  IF party_prefix IS NULL OR party_prefix = '' THEN
    party_prefix := generate_party_prefix(party_name);
    
    -- Update the party with the generated prefix
    UPDATE public.parties
    SET prefix = party_prefix
    WHERE id = p_party_id;
  END IF;
  
  -- Update the last order number
  UPDATE public.parties 
  SET last_order_number = next_num 
  WHERE id = p_party_id;
  
  -- Return formatted order number (padded to 3 digits)
  RETURN party_prefix || '/' || lpad(next_num::text, 3, '0');
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, new.raw_user_meta_data ->> 'full_name');
  
  -- First user becomes admin
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'user');
  END IF;
  
  RETURN new;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: material_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.materials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    category_id uuid,
    unit text DEFAULT 'Pcs'::text NOT NULL,
    rate numeric(10,2) DEFAULT 0 NOT NULL,
    current_stock numeric(10,2) DEFAULT 0 NOT NULL,
    min_stock numeric(10,2) DEFAULT 0,
    image_url text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: order_counter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_counter (
    id integer DEFAULT 1 NOT NULL,
    current_number integer DEFAULT 371 NOT NULL,
    prefix text DEFAULT 'SG'::text NOT NULL
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    serial_no integer NOT NULL,
    particular text NOT NULL,
    quantity numeric(10,2) NOT NULL,
    quantity_unit text DEFAULT 'Dzn'::text NOT NULL,
    rate_per_dzn numeric(10,2) NOT NULL,
    total numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_number text NOT NULL,
    party_id uuid,
    order_date date DEFAULT CURRENT_DATE NOT NULL,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    raw_material_deductions numeric(12,2) DEFAULT 0 NOT NULL,
    net_total numeric(12,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: parties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    address text,
    phone text,
    email text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    prefix text,
    last_order_number integer DEFAULT 0 NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: raw_material_deductions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.raw_material_deductions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    material_name text NOT NULL,
    quantity numeric(10,2) NOT NULL,
    rate numeric(10,2) NOT NULL,
    amount numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: stock_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    material_id uuid NOT NULL,
    transaction_type text NOT NULL,
    quantity numeric(10,2) NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stock_transactions_transaction_type_check CHECK ((transaction_type = ANY (ARRAY['add'::text, 'reduce'::text, 'order_deduction'::text])))
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role DEFAULT 'user'::public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: material_categories material_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_categories
    ADD CONSTRAINT material_categories_name_key UNIQUE (name);


--
-- Name: material_categories material_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_categories
    ADD CONSTRAINT material_categories_pkey PRIMARY KEY (id);


--
-- Name: materials materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_pkey PRIMARY KEY (id);


--
-- Name: order_counter order_counter_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_counter
    ADD CONSTRAINT order_counter_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: parties parties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parties
    ADD CONSTRAINT parties_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: raw_material_deductions raw_material_deductions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raw_material_deductions
    ADD CONSTRAINT raw_material_deductions_pkey PRIMARY KEY (id);


--
-- Name: stock_transactions stock_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transactions
    ADD CONSTRAINT stock_transactions_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: materials update_materials_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_materials_updated_at BEFORE UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: orders update_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: parties update_parties_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_parties_updated_at BEFORE UPDATE ON public.parties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: materials materials_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.material_categories(id) ON DELETE SET NULL;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: orders orders_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.parties(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: raw_material_deductions raw_material_deductions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raw_material_deductions
    ADD CONSTRAINT raw_material_deductions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: stock_transactions stock_transactions_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transactions
    ADD CONSTRAINT stock_transactions_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: material_categories Admins can manage categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage categories" ON public.material_categories TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: materials Admins can manage materials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage materials" ON public.materials TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: order_counter Admins can manage order_counter; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage order_counter" ON public.order_counter TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: order_items Admins can manage order_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage order_items" ON public.order_items TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: orders Admins can manage orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage orders" ON public.orders TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: parties Admins can manage parties; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage parties" ON public.parties TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: raw_material_deductions Admins can manage raw_material_deductions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage raw_material_deductions" ON public.raw_material_deductions TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: stock_transactions Admins can manage stock_transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage stock_transactions" ON public.stock_transactions TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can manage user_roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage user_roles" ON public.user_roles TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid()));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING ((id = auth.uid()));


--
-- Name: user_roles Users can view own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: material_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.material_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: materials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

--
-- Name: order_counter; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_counter ENABLE ROW LEVEL SECURITY;

--
-- Name: order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: parties; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: raw_material_deductions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.raw_material_deductions ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;